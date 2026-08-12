export interface AiRuntimeConcurrencyPort {
  acquire(
    scope: string,
  ): Promise<
    | Readonly<{ acquired: true; permitId: string }>
    | Readonly<{ acquired: false }>
  >;
  release(permitId: string): Promise<void>;
}
