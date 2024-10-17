import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule, provideExperimentalZonelessChangeDetection } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AppComponent } from "./app.component";
import { MyTableComponent } from "./my-table/my-table.component";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    MyTableComponent,
    BrowserAnimationsModule
  ],
  providers: [
    provideExperimentalZonelessChangeDetection()
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
