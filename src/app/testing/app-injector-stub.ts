import {Injector} from '@angular/core';
import {AppInjector, setAppInjector} from 'src/app/app-injector';

// For specs only. AppInjector can be set once, and spec files that run in the same
// test worker share it, so two specs that each set their own stand-in broke each
// other depending on which ran first. Every spec goes through this one stand-in
// instead. It answers from what the running spec registered and throws for anything
// else, so a dependency a spec does not know about still fails loudly.

const registered: Map<unknown, unknown> = new Map();

const stub = {
  get: (token: unknown) => {
    if (registered.has(token)) {
      return registered.get(token);
    }
    throw new Error(`unexpected AppInjector token: ${String(token)}`);
  },
} as unknown as Injector;

/** Answer AppInjector.get with these values until the next call replaces them. */
export function provideAppInjectorForTests(providers: [token: unknown, value: unknown][]): void {
  if (!AppInjector) {
    setAppInjector(stub);
  } else if (AppInjector !== stub) {
    throw new Error('AppInjector was already set by something other than the spec stub');
  }

  registered.clear();
  providers.forEach(([token, value]) => registered.set(token, value));
}
