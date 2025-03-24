import {Injectable, OnDestroy} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ListenerService implements OnDestroy {
  private listeners: {[scopeId: string]: (() => void)[]} = {};
  private idCounter = 0;

  // Generate a unique ID for a listener
  private generateUniqueId(): string {
    return `listener-${++this.idCounter}`;
  }

  listenTo(scopeOrId?: {$id?: string}): (() => void)[] {
    // If a scope is provided, use its ID as the scope ID
    const scopeId = scopeOrId?.$id || this.generateUniqueId();

    if (!this.listeners[scopeId]) {
      this.listeners[scopeId] = [];
    }
    return this.listeners[scopeId];
  }

  // Destroy all listeners for a given scope
  destroyListeners(scopeId: string): void {
    if (this.listeners[scopeId]) {
      this.listeners[scopeId].forEach((listener) => listener());
      delete this.listeners[scopeId];
    }
  }

  // Destroy all listeners
  ngOnDestroy(): void {
    Object.keys(this.listeners).forEach((scopeId) => this.destroyListeners(scopeId));
  }
}
