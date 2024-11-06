export function call<T>(v: T | ((...args: any[]) => T), ...args: any[]): T {
  if (typeof v === 'function') {
    // @ts-ignore
    return v(...args)
  } else {
    return v
  }
}

export function noop() {}

export function chain(...fns: Function[]): Function {
  if (fns.length === 0) return noop
  if (fns.length === 1) return fns[0]

  return function (this: any) {
    let result
    for (const fn of fns) {
      result = fn.apply(this, arguments) || result
    }
    return result
  }
}

export function assignDefault<T extends Object>(value: Partial<T> | undefined, fallback: T): T {
  return Object.assign({}, fallback, value || {})
}
