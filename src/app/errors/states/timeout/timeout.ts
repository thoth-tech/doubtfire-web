import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {AuthenticationService} from '../../../api/services/authentication.service'

@Component({
  selector: 'timeoutCtrl',
  templateUrl: './timeout.html',
  styleUrls: ['./timeout.scss'],
})
export class TimeoutComp {


constructor(private route: ActivatedRoute,private authenticationServic:AuthenticationService) {
    this.authenticationServic.signOut(false);
  }
}
