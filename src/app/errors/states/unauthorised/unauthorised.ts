import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'unauthorised',
  templateUrl: './unauthorised.html',
  styleUrls: ['./unauthorised.scss'],
})
export class UnauthorisedComponent{

  pageTitle: string = "Unauthorised";

  constructor(private route: ActivatedRoute) {

  }

}
