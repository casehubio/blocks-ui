import { z } from 'zod';

const documentInfoSchema = z.object({
  dsl: z.string().optional(),
  namespace: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
}).passthrough();

export const swfDocumentSchema = z.object({
  document: documentInfoSchema.optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  do: z.array(z.record(z.unknown())),
  use: z.unknown().optional(),
  timeout: z.unknown().optional(),
  schedule: z.unknown().optional(),
}).passthrough();
