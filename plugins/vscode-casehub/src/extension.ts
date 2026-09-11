import { type ExtensionContext } from 'vscode';
import { LanguageClient, type LanguageClientOptions, type ServerOptions, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = require.resolve('@casehubio/lsp-schemas/node');
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', pattern: '**/*.page.yaml' },
      { scheme: 'file', pattern: '**/*.dash.yaml' },
      { scheme: 'file', pattern: '**/*.case.yaml' },
      { scheme: 'file', pattern: '**/*.swf.yaml' },
      { scheme: 'file', pattern: '**/*.htn.yaml' },
      { scheme: 'file', pattern: '**/*.org.yaml' },
      { scheme: 'file', language: 'yaml' },
    ],
  };

  client = new LanguageClient('casehub-yaml', 'CaseHub YAML', serverOptions, clientOptions);
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
