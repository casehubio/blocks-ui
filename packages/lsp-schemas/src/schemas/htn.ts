import { z } from 'zod';

const htnMethodSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  guard: z.string().optional(),
  guardLabel: z.string().optional(),
  strategy: z.string().optional(),
  estimatedCost: z.number().optional(),
  estimatedDuration: z.string().optional(),
  tasks: z.array(htnTaskSchema),
}));

const htnTaskSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  name: z.string(),
  capability: z.string().optional(),
  definitionRef: z.string().optional(),
  methods: z.array(htnMethodSchema).optional(),
}));

export const htnDocumentSchema = z.object({
  dsl: z.string().optional(),
  namespace: z.string().optional(),
  name: z.string().optional(),
  spec: z.object({
    decomposition: z.object({
      root: htnTaskSchema,
    }),
  }),
});
