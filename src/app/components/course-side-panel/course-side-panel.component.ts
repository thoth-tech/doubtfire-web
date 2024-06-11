import { Component, OnInit } from '@angular/core';
import { CourseService } from './../../services/course.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-course-side-panel',
  templateUrl: './course-side-panel.component.html',
  styleUrls: ['./course-side-panel.component.scss']
})
export class CourseSidePanelComponent implements OnInit {
  courseCode: string;
  courseName: string;
  courseCredits: number;
  courseType: string;
  prerequisites: string[];
  learningOutcomes: string[];

  constructor(
    private courseService: CourseService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.getCourseData();
  }

  getCourseData(): void {
    // 假设课程ID是从当前路由中获取的
    const courseId = 'COURSE_ID_FROM_ROUTE';
    this.courseService.getCourseById(courseId).subscribe(course => {
      this.courseCode = course.code;
      this.courseName = course.name;
      this.courseCredits = course.credits;
      this.courseType = course.type;
      this.prerequisites = course.prerequisites;
      this.learningOutcomes = course.learningOutcomes;
    });
  }

  viewCourse(): void {
    // 导航到课程详情页面
    this.router.navigate(['/courses', this.courseCode]);
  }
}






