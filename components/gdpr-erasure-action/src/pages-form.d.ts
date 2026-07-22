import '@casehubio/pages-form';

declare module '@casehubio/pages-form' {
  interface FieldSchema {
    oneOf?: readonly { readonly const: string; readonly title: string }[];
  }
}
