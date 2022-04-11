import { Component, Input } from "@angular/core";



@Component({
  selector:'app-alert-list',
  templateUrl:'./alert-list.component.html'
})
export class AlertListComponent{
  @Input() alerts:any;
}
