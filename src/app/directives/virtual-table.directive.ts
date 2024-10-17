import { ArrayDataSource, CollectionViewer, isDataSource, ListRange } from "@angular/cdk/collections";
import { CdkVirtualScrollRepeater, CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { CdkHeaderRowDef, CdkTable, DataSource,  STICKY_POSITIONING_LISTENER, _CoalescedStyleScheduler, _COALESCED_STYLE_SCHEDULER } from "@angular/cdk/table";
import { ContentChildren, Directive, ElementRef, Inject, Input, NgIterable, NgZone, QueryList } from "@angular/core";
import { isObservable, Observable, of, Subject } from "rxjs";
import { map, pairwise, shareReplay, startWith, switchMap, takeUntil } from "rxjs/operators";
import { TableVirtualScrollViewportComponent } from "../table-virtual-scroll-viewport/table-virtual-scroll-viewport.component";

/**
 * Directive that wraps a given data source in a "virtual" data source that emits
 * the slice of the original data source that matches the range that should be rendered
 * in the containing virtual scroll viewport.
 */
@Directive({
  selector: '[mat-table][appVirtualDataSource], mat-table[appVirtualDataSource]',
  standalone: true,
  providers: [{ provide: STICKY_POSITIONING_LISTENER, useExisting: VirtualTableDirective }]
})
export class VirtualTableDirective<T> implements CdkVirtualScrollRepeater<T>, CollectionViewer {
  @Input('appVirtualDataSource')
  set dataSource(value: DataSource<T> | Observable<T[]> | NgIterable<T> | null | undefined) {
    this._dataSource = value;
    if (isDataSource(value)) {
      this.dataSourceChanges.next(value);
    } else {
      this.dataSourceChanges.next(new ArrayDataSource<T>(isObservable(value) ? value : Array.from(value || [])));
    }
  }
  get dataSource(): DataSource<T> | Observable<T[]> | NgIterable<T> | null | undefined {
    return this._dataSource;
  }
  private _dataSource: DataSource<T> | Observable<T[]> | NgIterable<T> | null | undefined;

  @ContentChildren(CdkHeaderRowDef) headerRowDefs: QueryList<CdkHeaderRowDef>;

  private virtualizedDataStream = new Subject<T[] | ReadonlyArray<T>>();

  private dataSourceChanges = new Subject<DataSource<T>>();

  /** The raw, unvirtualized data stream. Emits whenever the data in the current DataSource changes. */
  dataStream: Observable<T[] | ReadonlyArray<T>> = this.dataSourceChanges
    .pipe(
      // Start off with null data source.
      startWith(null),
      // Bundle up the previous and current data sources so we can work with both.
      pairwise(),
      // Use `changeDataSource` to disconnect from the previous data source and connect to the
      // new one, passing back a stream of data changes which we run through `switchMap` to give
      // us a data stream that emits the latest data from whatever the current data source is.
      switchMap(([prev, cur]) => this.changeDataSource(prev, cur)),
      // Replay the last emitted data when someone subscribes.
      shareReplay(1));

  viewChange = new Subject<ListRange>();

  private data: T[] | readonly T[];

  private destroyed$ = new Subject<void>();

  private renderedItems: T[] | ReadonlyArray<T>;

  private renderedRange: ListRange = { start: 0, end: 0 };

  private isNativeHtmlTable: boolean = false;

  constructor(
    elementRef: ElementRef<HTMLElement>,
    private viewport: CdkVirtualScrollViewport,
    private table: CdkTable<T>,
    ngZone: NgZone,
    @Inject(_COALESCED_STYLE_SCHEDULER) private _coalescedStyleScheduler: _CoalescedStyleScheduler,
  ) {
    table.dataSource = this.virtualizedDataStream;
    this.isNativeHtmlTable = elementRef.nativeElement.tagName === 'TABLE';
    this.dataStream.subscribe(data => {
      this.data = data;
      this.onRenderedDataChange();
    });
    viewport.renderedRangeStream.pipe(takeUntil(this.destroyed$)).subscribe((range: ListRange) => {
      this.renderedRange = range;
      ngZone.run(() => this.viewChange.next(range));
      this.onRenderedDataChange();
    });
    viewport.attach(this);
  }

  ngOnInit(): void {
    // This is just a proof of concept, but the TableVirtualScrollViewportComponent uses `position: absolute` and `top: #px` instead of `transform: translateY(#px)` to position the viewport.
    // This removes the need to account for the translation in the `top` of the sticky header rows.
    if (this.viewport instanceof TableVirtualScrollViewportComponent) {
      return;
    }

    this.viewport.scrolledIndexChange
      .pipe(
        map(() => this.viewport.getOffsetToRenderedContentStart()),
        takeUntil(this.destroyed$)
      )
      .subscribe((offset) => {
        // We need to set the `style.top` property of the sticky header rows
        // to the negative value of the virtual scroll viewport's offset, so
        // make the offset negative.
        offset = -offset;

        const stickyStates: boolean[] = this.headerRowDefs.map(rowDef => rowDef.sticky);

        // This logic is exactly the same as what's in the StickyStyler (literally copy + paste).
        // The only difference is that the `stickyOffset` variable starts at the virtual scroll
        // viewport container's offset instead of starting at zero.
        const rows = this.table._getRenderedRows(this.table._headerRowOutlet);
        const stickyOffsets: number[] = [];
        const stickyCellHeights: (number|undefined)[] = [];
        const elementsToStick: HTMLElement[][] = [];
        for (let rowIndex = 0, stickyOffset = offset; rowIndex < rows.length; rowIndex++) {
          stickyOffsets[rowIndex] = stickyOffset;

          if (!stickyStates[rowIndex]) {
            continue;
          }

          const row = rows[rowIndex];
          elementsToStick[rowIndex] = this.isNativeHtmlTable ? Array.from(row.children) as HTMLElement[] : [row];

          const height = row.getBoundingClientRect().height;
          stickyOffset += height;
          stickyCellHeights[rowIndex] = height;
        }

        // Using the CoalescedStyleScheduler here is optional. It'll work without it,
        // and CoalescedStyleScheduler is not public (yet?), so feel free to remove it.
        this._coalescedStyleScheduler.schedule(() => {
          for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            if (!stickyStates[rowIndex]) {
              continue;
            }

            for (const element of elementsToStick[rowIndex]) {
              element.style.top = `${stickyOffsets[rowIndex]}px`;
            }
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.dataSourceChanges.complete();
    this.virtualizedDataStream.complete();
  }

    /** React to scroll state changes in the viewport. */
  private onRenderedDataChange() {
    if (!this.renderedRange) {
      return;
    }
    this.renderedItems = this.data.slice(this.renderedRange.start, this.renderedRange.end);
    // delegate rendering to the table by emitting from the virtualizedDataStream
    this.virtualizedDataStream.next(this.renderedItems);
  }

  /** Swap out one data source for another. */
  private changeDataSource(oldDataSource: DataSource<T> | null, newDs: DataSource<T> | null):
      Observable<T[] | ReadonlyArray<T>> {

    oldDataSource?.disconnect(this);
    return newDs ? newDs.connect(this) : of();
  }

  /**
   * This method is only used by the experimental AutoSizeVirtualScrollStrategy.
   * We're not using that strategy, but I've implemented it just to show how it oculd be done.
   * I'm not actually sure if this works.
   */
  measureRangeSize(range: ListRange, orientation: 'horizontal' | 'vertical'): number {
    if (orientation === 'horizontal' || range.end < range.start) {
      // virtual scrolling columns are not supported by this directive
      return 0;
    }

    const renderedBodyRows = this.table._getRenderedRows(this.table._rowOutlet);

    const firstRow: HTMLElement | undefined = renderedBodyRows[range.start];
    const lastRow: HTMLElement | undefined = renderedBodyRows[range.end];

    if (!firstRow || !lastRow) {
      return 0;
    }

    // We need to include all header and footer rows in the sum, since they're always rendered
    const renderedHeaderRows = this.table._getRenderedRows(this.table._headerRowOutlet);
    const renderedFooterRows = this.table._getRenderedRows(this.table._footerRowOutlet);

    // TODO (performance): Can we just measure the offset of the first and last items and do some math to avoid having to measure each row individually?
    const headerHeight = renderedHeaderRows.reduce((sum: number, row: HTMLElement) => {
      return sum += row.getBoundingClientRect().height;
    }, 0);
    const footerHeight = renderedFooterRows.reduce((sum: number, row: HTMLElement) => {
      return sum += row.getBoundingClientRect().height;
    }, 0);

    const bodyHeight = lastRow.getBoundingClientRect().bottom - firstRow.getBoundingClientRect().top;

    return headerHeight + footerHeight + bodyHeight;
  }
}
