import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";
import { MatTableModule } from "@angular/material/table";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AppComponent } from "./app.component";
import { MyTableComponent } from "./my-table/my-table.component";
import { VirtualTableDirective } from "./directives/virtual-table.directive";
import { FixedRowSizeTableVirtualScrollStrategyDirective } from "./directives/fixed-row-size-table-virtual-scroll-strategy.directive";
import { TableVirtualScrollViewportComponent } from './table-virtual-scroll-viewport/table-virtual-scroll-viewport.component';

@NgModule({
  declarations: [
    AppComponent,
    MyTableComponent,
    VirtualTableDirective,
    FixedRowSizeTableVirtualScrollStrategyDirective,
    TableVirtualScrollViewportComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ScrollingModule,
    MatTableModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
