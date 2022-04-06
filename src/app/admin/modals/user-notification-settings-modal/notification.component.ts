import { Component, OnInit, TemplateRef } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';

type userModel = {
  receive_task_notifications: Boolean;
  receive_feedback_notifications: Boolean;
  receive_portfolio_notifications: Boolean;
};

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
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
    // animated: true, // 为true时，弹窗出现和取消时有动画效果
    // keyboard: true, // 为true时，点击键盘Esc键可以取消弹窗
    // backdrop: true, // 为 true时，弹窗出现时背景变灰
    // ignoreBackdropClick: true, // 为true时，点击背景弹窗不会消失
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
  // getClassList(val: string) {

  // }
  ngOnInit(): void {}
  //打开 模态框，size:默认
  openModal(template: TemplateRef<any>) {
    this.curModal = this.modalService.show(template, this.config);
  }
  // 打开模态框，size:大
  openModalWithClass(template: TemplateRef<any>) {
    this.curModal = this.modalService.show(template, Object.assign({}, this.config, { class: 'gray modal-lg' }));
  }
}
