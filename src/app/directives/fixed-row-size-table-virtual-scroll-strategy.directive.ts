import { coerceNumberProperty, NumberInput } from "@angular/cdk/coercion";
import {
  CdkVirtualScrollViewport,
  VirtualScrollStrategy,
  VIRTUAL_SCROLL_STRATEGY
} from "@angular/cdk/scrolling";
import { AfterContentInit, ContentChildren, Directive, forwardRef, Input, QueryList } from "@angular/core";
import { MatHeaderRowDef } from "@angular/material/table";
import { Subject } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";

/**
 * A custom scroll strategy that accepts a static row height, static header height,
 * and a buffer size. The strategy 
 */
export class FixedRowSizeTableVirtualScrollStrategy
  implements VirtualScrollStrategy {
  
  viewport: CdkVirtualScrollViewport | null;

  private buffer: number;

  private headerHeight: number;

  private rowHeight: number;

  constructor(rowHeight: number, buffer: number, headerHeight: number) {
    this.updateRowHeightAndBuffer(rowHeight, buffer, headerHeight);
  }

  private _scrolledIndexChange = new Subject<number>();

  scrolledIndexChange = this._scrolledIndexChange.pipe(distinctUntilChanged());

  /**
   * Attaches this scroll strategy to a viewport.
   * @param viewport The viewport to attach this strategy to.
   */
  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
    this.updateTotalContentSize();
    this.updateRenderedRange();
  }

  /**
   * Detaches this scroll strategy from the currently attached viewport.
   */
  detach(): void {
    this._scrolledIndexChange.complete();
    this.viewport = null;
  }

  onContentScrolled(): void {
    this.updateRenderedRange();
  }

  onDataLengthChanged(): void {
    this.updateTotalContentSize();
    this.updateRenderedRange();
  }

  onContentRendered(): void {
    // This method is useful for virtual scroll strategies that measure the rendered
    // content to determine its height. This scroll strategy assumes that rows have
    // a static height, so there's no need to implement this method.
  }

  onRenderedOffsetChanged(): void {
    // Similar to onContentRendered, this method is useful for virtual scroll strategies
    // that need to track the offset as it changes. This scroll strategy is always able
    // to calculate the correct offset from other values, so there's no need to implement
    // this method.
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    this.viewport?.scrollToOffset(index * this.rowHeight, behavior);
  }

  /**
   * Update the item size and buffer size.
   * @param rowHeight The height of a row in the virtually scrolling table.
   * @param buffer The number of rows to buffer outside the viewport.
   * @param headerHeight The total height of the table header, including all header rows.
   */
  updateRowHeightAndBuffer(rowHeight: number, buffer: number, headerHeight: number) {
    this.rowHeight = rowHeight;
    this.buffer = buffer;
    this.headerHeight = headerHeight;
    this.updateTotalContentSize();
    this.updateRenderedRange();
  }

  protected updateRenderedRange() {
    if (!this.viewport) {
        return;
    }

    const viewportSize = this.viewport.getViewportSize();
    const dataLength = this.viewport.getDataLength();
    const scrollOffset = this.viewport.measureScrollOffset();

    // the index of the first item that would be at least partially visible in the viewport
    let firstVisibleIndex =
      Math.floor((scrollOffset + this.headerHeight) / this.rowHeight);
    
    // if the buffer size is 10 but the first visible item is at, say, index 7
    // then the buffered items must be 7, because we don't have 10 items available to buffer.
    const bufferedItems = Math.min(this.buffer, firstVisibleIndex);

    const itemsInViewport = Math.ceil(viewportSize / this.rowHeight);
    const itemsToRender = itemsInViewport + this.buffer;

    // Clamp the new range between 0 and dataLength
    const newStart = Math.max(0, firstVisibleIndex - bufferedItems);
    const newEnd = Math.min(dataLength - 1, firstVisibleIndex + itemsToRender);

    const newRange = {
      start: newStart,
      end: newEnd
    };
    const newOffset = this.rowHeight * (firstVisibleIndex - bufferedItems);
    this.viewport.setRenderedContentOffset(newOffset);
    this.viewport.setRenderedRange(newRange);
    this._scrolledIndexChange.next(Math.floor(firstVisibleIndex));
  }

  protected updateTotalContentSize() {
    this.viewport?.setTotalContentSize(this.viewport.getDataLength() * this.rowHeight);
  }
}

/**
 * Provider factory for `FixedSizeVirtualScrollStrategy` that simply extracts the already created
 * `FixedSizeVirtualScrollStrategy` from the given directive.
 * @param fixedSizeDir The instance of `CdkFixedSizeVirtualScroll` to extract the
 *     `FixedSizeVirtualScrollStrategy` from.
 */
export function fixedSizeVirtualScrollStrategyFactory(
  fixedSizeDir: FixedRowSizeTableVirtualScrollStrategyDirective
) {
  return fixedSizeDir.scrollStrategy;
}

@Directive({
  selector: "cdk-virtual-scroll-viewport[rowHeight], app-table-virtual-scroll-viewport[rowHeight]",
  standalone: true,
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: fixedSizeVirtualScrollStrategyFactory,
      deps: [forwardRef(() => FixedRowSizeTableVirtualScrollStrategyDirective)]
    }
  ]
})
export class FixedRowSizeTableVirtualScrollStrategyDirective implements AfterContentInit {
    /** The height of rows in the table (in pixels). Defaults to 48. */
  @Input()
  set rowHeight(value: number) { this._rowHeight = coerceNumberProperty(value); }
  get rowHeight(): number { return this._rowHeight; }
  private _rowHeight = 48;

  /**
   * The height of header rows in the table (in pixels). Defaults to 48.
   */
  @Input()
  set headerRowHeight(value: number) { this._headerRowHeight = coerceNumberProperty(value); }
  get headerRowHeight(): number { return this._headerRowHeight; }
  private _headerRowHeight: number = 48;

  /**
   * The number of buffered rows rendered beyond the viewport.
   * If the number of buffered rows dips below this number, more rows will be rendered. Defaults to 20.
   */
  @Input()
  set buffer(value: number) { this._buffer = coerceNumberProperty(value); }
  get buffer(): number { return this._buffer; }
  private _buffer = 20;

  @Input()
  set headerRows(value: number | null | undefined) { this._headerRows = coerceNumberProperty(value, undefined); }
  get headerRows(): number | null | undefined { return this._headerRows; }
  private _headerRows: number | null | undefined = null;

  /**
   * Using ContentChildren here fails to pick up row defs that are added programmatically,
   * but we don't really have a way of handling that without accessing private methods of 
   * the CdkTable. Adding header row defs programmatically is uncommon, so ContentChildren
   * is usually sufficient. The explicit `headerRows` input above allows the number of rows
   * to be set by the developer to override the QueryList-driven behavior.
   */
  @ContentChildren(MatHeaderRowDef) headerRowsQuery: QueryList<MatHeaderRowDef>;

  private headerRowCount: number = 1;

  /** The scroll strategy used by this directive. */
  scrollStrategy = new FixedRowSizeTableVirtualScrollStrategy(
    this.rowHeight,
    this.buffer,
    this.headerRowHeight * this.headerRowCount
  );

  ngOnChanges() {
    if (this.headerRows != undefined || this.headerRowsQuery) {
      this.handleChange();
    }
  }

  ngAfterContentInit(): void {
    this.headerRowsQuery.changes.subscribe(() => {
      this.handleChange();
    });
  }

  private handleChange(): void {
    this.scrollStrategy.updateRowHeightAndBuffer(
      this.rowHeight,
      this.buffer,
      // Use the explicit headerRows input value if set.
      // Otherwise, fall back to the QueryList length.
      this.headerRowHeight * (this._headerRows ?? this.headerRowsQuery.length)
    );
  }

  static ngAcceptInputType_rowHeight: NumberInput;
  static ngAcceptInputType_buffer: NumberInput;
  static ngAcceptInputType_headerRowHeight: NumberInput;
}
