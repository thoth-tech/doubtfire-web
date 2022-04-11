import { Component, OnInit, TemplateRef } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';

type userModel = {
  receive_task_notifications: Boolean;
  receive_feedback_notifications: Boolean;
  receive_portfolio_notifications: Boolean;
};

@Component({
  selector: 'notific-setting',
  templateUrl: './notification.component.html',
  providers: [BsModalService],
})
export class notificationComponent implements OnInit {
  curModal: BsModalRef;
  public user: userModel;
  public radioModel: string;
  public classList: Array<string>;
  config = {
    animated: true, 
    keyboard: true, 
    backdrop: true, 
    ignoreBackdropClick: false,
  };
  constructor(private modalService: BsModalService) {
    this.user = {
      receive_task_notifications: false,
      receive_feedback_notifications: false,
      receive_portfolio_notifications: false,
    };
    this.radioModel = 'Middle';
  }
  changeItem(val: string, judge: Boolean) {
    this.user[val] = judge;
  }
  formSubmit() {
    console.log(this.user);
    this.curModal.hide();
  }
  get getClassList() {
    let arr = ['btn', 'btn-default', this.user['receive_task_notifications'] ? 'active' : ''];
    return arr.join(' ');
  }
  get getClassList1() {
    let arr = ['btn', 'btn-default', this.user['receive_task_notifications'] ? '' : 'active'];
    return arr.join(' ');
  }
  get getClassList2() {
    let arr = ['btn', 'btn-default', this.user['receive_feedback_notifications'] ? 'active' : ''];
    return arr.join(' ');
  }
  get getClassList3() {
    let arr = ['btn', 'btn-default', this.user['receive_feedback_notifications'] ? '' : 'active'];
    return arr.join(' ');
  }
  get getClassList4() {
    let arr = ['btn', 'btn-default', this.user['receive_portfolio_notifications'] ? 'active' : ''];
    return arr.join(' ');
  }
  get getClassList5() {
    let arr = ['btn', 'btn-default', this.user['receive_portfolio_notifications'] ? '' : 'active'];
    return arr.join(' ');
  }

  ngOnInit(): void {}
  openModal(template: TemplateRef<any>) {
    this.curModal = this.modalService.show(template, this.config);
  }
  
  openModalWithClass(template: TemplateRef<any>) {
    this.curModal = this.modalService.show(template, Object.assign({}, this.config, { class: 'gray modal-lg' }));
  }
}
