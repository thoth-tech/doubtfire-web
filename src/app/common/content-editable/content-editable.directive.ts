import { Directive, ElementRef, HostListener, Renderer2, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';

@Directive({
  selector: '[contentEditable]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ContentEditableDirective),
      multi: true
    }
  ]
})
export class ContentEditableDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  
  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private sanitizer: DomSanitizer
  ) {}
  
  @HostListener('blur')
  onBlur() {
    this.onTouched();
  }
  
  @HostListener('blur')
  @HostListener('keyup')
  @HostListener('change')
  onInputChange() {
    // This matches the original "read" function
    const value = this.el.nativeElement.innerText;
    this.onChange(value);
  }
  
  // ControlValueAccessor methods
  writeValue(value: string): void {
    // This matches the original $render function
    const sanitizedValue = this.sanitizer.bypassSecurityTrustHtml(value || '');
    this.renderer.setProperty(this.el.nativeElement, 'innerHTML', sanitizedValue);
  }
  
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.renderer.setAttribute(this.el.nativeElement, 'contenteditable', isDisabled ? 'false' : 'true');
  }
}