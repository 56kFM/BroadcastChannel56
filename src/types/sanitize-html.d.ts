declare module 'sanitize-html' {
  export type Options = any;
  const sanitizeHtml: (dirty: string, options?: Options) => string;
  export default sanitizeHtml;
}
