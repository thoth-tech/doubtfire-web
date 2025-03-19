import {Injectable, OnDestroy} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ListenerService implements OnDestroy {
  private listeners: {[scopeId: string]: (() => void)[]} = {};

  /**
   * Registers listeners for a given scope (or component).
   * @param scopeId - A unique identifier for the scope (e.g., component instance or AngularJS $scope).
   * @returns An array of cleanup functions for the registered listeners.
   */
  listenTo(scopeId: string): (() => void)[] {
    if (!this.listeners[scopeId]) {
      this.listeners[scopeId] = [];
    }
    //console.log('👂: ', 'ListenerService.listenTo', scopeId);
    return this.listeners[scopeId];
  }

  /**
   * Cleans up listeners when the scope (or component) is destroyed.
   * @param scopeId - The unique identifier for the scope.
   */
  destroyListeners(scopeId: string): void {
    if (this.listeners[scopeId]) {
      this.listeners[scopeId].forEach((listener) => listener());
      delete this.listeners[scopeId];
      //console.log('❌: ', 'ListenerService.destroyListeners', scopeId);
    }
  }

  /**
   * Angular lifecycle hook to clean up all listeners when the service is destroyed.
   */
  ngOnDestroy(): void {
    Object.keys(this.listeners).forEach((scopeId) => this.destroyListeners(scopeId));
  }
}
