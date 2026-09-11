# PPI Progress Calculation Rules

Completion percentage is calculated as:

completed available tasks / total available tasks × 100

Results are rounded to the nearest whole number using `Math.round()`.

If there are no available tasks, the result is treated as unavailable rather than dividing by zero.

If cohort data is missing or suppressed, the student-to-cohort comparison is also treated as unavailable.

The current comparison value is calculated as:

student completion percentage - cohort completion percentage
