import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'virtualScrollHeight',
  standalone: true,
})
export class VirtualScrollHeightPipe implements PipeTransform {
  transform(items: any[], rowHeight = 51, headerRowHeight = 56): number {
    if(!items || !items?.length) {
      // assumption is one header row + one empty row
      return (rowHeight + headerRowHeight);
    } else if(items.length > 10) {
      return ((11 * rowHeight) + headerRowHeight);
    } else {
      return ((items?.length * rowHeight) + headerRowHeight);
    }
    
  }
}
