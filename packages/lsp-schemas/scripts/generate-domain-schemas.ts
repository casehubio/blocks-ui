import { Project, Type, Symbol as MorphSymbol, SyntaxKind } from 'ts-morph';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FormatConfig {
  formatId: string;
  rootTypeName: string;
  sourceFile: string;
  outputFile: string;
  exportName: string;
  discriminatorManifest?: string;
}

interface DiscriminatorRule {
  strategy: 'key-presence';
  discriminatorKeys: string[];
  sharedKeys: string[];
}

type DiscriminatorManifest = Record<string, DiscriminatorRule>;

const FUNCTION_PROPS = new Set<string>();

function isFunction(type: Type): boolean {
  return type.getCallSignatures().length > 0;
}

function isIndexSignature(prop: MorphSymbol): boolean {
  const decl = prop.getValueDeclaration();
  if (!decl) return false;
  return decl.getKind() === SyntaxKind.IndexSignature;
}

const namedSchemas = new Map<string, string>();
let schemaCounter = 0;

function getSchemaVarName(symbolName: string): string {
  const base = symbolName.charAt(0).toLowerCase() + symbolName.slice(1);
  return `${base}Schema`;
}

export function typeToZod(type: Type, depth: number, visited: Set<string>): string {
  if (depth > 10) return 'z.unknown()';

  const text = type.getText();

  if (type.isString() || type.isStringLiteral()) return 'z.string()';
  if (type.isNumber() || type.isNumberLiteral()) return 'z.number()';
  if (type.isBoolean() || type.isBooleanLiteral()) return 'z.boolean()';
  if (type.isNull()) return 'z.null()';
  if (type.isUndefined()) return 'z.undefined()';
  if (text === 'unknown') return 'z.unknown()';
  if (text === 'never') return 'z.never()';

  if (type.isUnion()) {
    const members = type.getUnionTypes().filter(t => !t.isUndefined());
    if (members.length === 0) return 'z.undefined()';
    if (members.every(m => m.isStringLiteral())) {
      const values = members.map(m => JSON.stringify(m.getLiteralValue()));
      return `z.enum([${values.join(', ')}])`;
    }
    if (members.every(m => m.isBooleanLiteral())) return 'z.boolean()';
    if (members.length === 1) return typeToZod(members[0], depth + 1, visited);
    const zodMembers = members.map(m => typeToZod(m, depth + 1, visited));
    return `z.union([${zodMembers.join(', ')}])`;
  }

  if (type.isArray()) {
    const elem = type.getArrayElementType();
    if (!elem) return 'z.array(z.unknown())';
    return `z.array(${typeToZod(elem, depth + 1, visited)})`;
  }

  if (text.startsWith('readonly ') && text.endsWith('[]')) {
    const inner = type.getTypeArguments()[0];
    if (inner) return `z.array(${typeToZod(inner, depth + 1, visited)})`;
    return 'z.array(z.unknown())';
  }

  if (type.isTuple()) {
    const elements = type.getTupleElements();
    const zodElements = elements.map(e => typeToZod(e, depth + 1, visited));
    return `z.tuple([${zodElements.join(', ')}])`;
  }

  if (text.startsWith('Record<') || text.startsWith('Readonly<Record<')
      || text.includes('Record<string,')) {
    const typeArgs = type.getAliasTypeArguments();
    if (typeArgs.length === 2) {
      return `z.record(${typeToZod(typeArgs[1], depth + 1, visited)})`;
    }
    const indexType = type.getStringIndexType();
    if (indexType) return `z.record(${typeToZod(indexType, depth + 1, visited)})`;
    return 'z.record(z.unknown())';
  }

  if (type.isObject() && !type.isArray()) {
    const stringIndexType = type.getStringIndexType();
    const props = type.getProperties();
    const nonIndexProps = props.filter(p => !isIndexSignature(p) && !p.getName().startsWith('__@'));
    if (stringIndexType && nonIndexProps.length === 0) {
      return `z.record(${typeToZod(stringIndexType, depth + 1, visited)})`;
    }

    const symbol = type.getSymbol() || type.getAliasSymbol();
    const symbolId = symbol?.getFullyQualifiedName() ?? '';

    if (symbolId && visited.has(symbolId)) {
      const name = symbol!.getName();
      return `${getSchemaVarName(name)}`;
    }

    if (symbolId) visited.add(symbolId);

    if (props.length === 0) {
      if (symbolId) visited.delete(symbolId);
      return 'z.object({})';
    }

    const fields = props
      .map(p => propToZodField(p, depth + 1, visited))
      .filter(Boolean);

    if (symbolId) visited.delete(symbolId);

    if (fields.length === 0) return 'z.object({})';
    const indent = '  '.repeat(depth + 2);
    const closingIndent = '  '.repeat(depth + 1);
    return `z.object({\n${indent}${fields.join(`,\n${indent}`)},\n${closingIndent}})`;
  }

  return 'z.unknown()';
}

export function propToZodField(
  prop: MorphSymbol,
  depth: number,
  visited: Set<string>,
): string {
  const name = prop.getName();
  if (isIndexSignature(prop)) return '';
  if (name.startsWith('__@')) return '';

  const decl = prop.getValueDeclaration();
  if (!decl) return '';

  const type = prop.getTypeAtLocation(decl);
  if (isFunction(type)) return '';

  const isOptional = prop.isOptional();
  const baseType = isOptional ? type.getNonNullableType() : type;
  let zodType = typeToZod(baseType, depth, visited);
  if (!zodType) return '';
  if (isOptional) zodType += '.optional()';

  const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : `"${name}"`;
  return `${safeName}: ${zodType}`;
}

function generateHeader(sourceDesc: string): string {
  return `// AUTO-GENERATED by scripts/generate-domain-schemas.ts — DO NOT EDIT
// Re-generate: yarn workspace @casehubio/lsp-schemas run generate
// Source: ${sourceDesc}
import { z } from "zod";
`;
}

export function generateFormatSchema(
  project: Project,
  config: FormatConfig,
): string {
  const sourceFile = project.getSourceFileOrThrow(
    resolve(__dirname, config.sourceFile),
  );

  let rootType: Type;
  const typeAlias = sourceFile.getTypeAlias(config.rootTypeName);
  if (typeAlias) {
    rootType = typeAlias.getType();
  } else {
    const iface = sourceFile.getInterfaceOrThrow(config.rootTypeName);
    rootType = iface.getType();
  }

  const visited = new Set<string>();
  const zodCode = typeToZod(rootType, 0, visited);
  return `${generateHeader(config.sourceFile)}\nexport const ${config.exportName} = ${zodCode};\n`;
}

export const FORMATS: FormatConfig[] = [];

if (typeof process !== 'undefined' && process.argv[1] &&
    import.meta.url === `file://${process.argv[1]}`) {
  const project = new Project({
    tsConfigFilePath: resolve(__dirname, '../tsconfig.generator.json'),
  });

  for (const config of FORMATS) {
    const output = generateFormatSchema(project, config);
    const outPath = resolve(__dirname, config.outputFile);
    writeFileSync(outPath, output, 'utf-8');
    console.log(`Generated ${config.formatId} schema to ${outPath}`);
  }

  if (FORMATS.length === 0) {
    console.log('No formats configured yet.');
  }
}
