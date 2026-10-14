export abstract class Builder {
  /**
   * Copies the builder with `patch` applied. Methods that change a type
   * parameter name the resulting builder type as `Next`.
   */
  protected with<Next extends Builder = this>(patch: object): Next {
    return Object.assign(
      Object.create(Object.getPrototypeOf(this) as object) as Next,
      this,
      patch,
    )
  }
}

// TypeScript only accepts mixins over constructors taking `...args: any[]`.
// oxlint-disable-next-line typescript/no-explicit-any
export type Mixin<Instance> = abstract new (...args: any[]) => Instance
