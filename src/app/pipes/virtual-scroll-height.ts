import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'virtualScrollHeight',
  standalone: true,
})
export class VirtualScrollHeightPipe implements PipeTransform {
  transform(items: any[], rowHeight = 51): number {
    if(!items || !items?.length) {
      return rowHeight;
    } else if(items.length > 10) {
      return (11 * rowHeight);
    } else {
      return (items?.length * rowHeight);
    }
    
  }
}
