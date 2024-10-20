import { Pipe, PipeTransform } from '@angular/core';
import { Ticket } from '@razroo-zeta/data-models';

@Pipe({
  name: 'virtualScrollHeight',
  standalone: true,
})
export class VirtualScrollHeightPipe implements PipeTransform {
  transform(tickets: Ticket[], rowHeight = 51, headerRowHeight = 56): number {
    if(!tickets || !tickets?.length) {
      // assumption is one header row + one empty row
      return (rowHeight + headerRowHeight);
    } else if(tickets.length > 10) {
      return ((11 * rowHeight) + headerRowHeight);
    } else {
      return ((tickets?.length * rowHeight) + headerRowHeight);
    }
    
  }
}
