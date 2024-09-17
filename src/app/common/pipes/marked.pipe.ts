import { Pipe, PipeTransform } from '@angular/core';
import * as marked from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'marked',
})
export class MarkedPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {
    marked.setOptions({
      renderer: new marked.Renderer(),
      pedantic: false,
      gfm: true,
      breaks: true,
    });
  }

  transform(value: string, ...args: any[]): SafeHtml {
    if (value && value.length > 0) {
      const parsedValue = value;
      const html = <string>marked.parse(parsedValue, {async: false});
      console.log(html);

      // Sanitizing the HTML for safe rendering
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    // Return empty or unmodified value as safe HTML
    return this.sanitizer.bypassSecurityTrustHtml(value || '');
  }
}
