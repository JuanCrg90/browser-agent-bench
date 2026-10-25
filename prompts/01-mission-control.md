# Task 1: Mission Control

Build a polished, responsive project-management dashboard for a small engineering team. Prioritize usable information hierarchy over decorative charts.

## Input and definitions

Fetch the supplied `/mission-control.json` on first use. Its top-level fields are `referenceDate`, `projects`, and `tasks`. Each task belongs to one project by `projectId`. Do not replace, invent, or hardcode an alternative dataset.

- Status is exactly `todo`, `in_progress`, or `done`; display friendly labels.
- Dates are date-only strings in `YYYY-MM-DD` form. Use the supplied reference date, not the computer's current date, for overdue calculations.
- A task is overdue when its deadline precedes the reference date and its status is not `done`.
- Progress is completed task count divided by total task count, rounded to the nearest whole percent. A project with no tasks has 0% progress.

## Required features

1. Show all project names, descriptions, and progress. Show global task count, counts for each status, overdue count, and overall completion percentage. These summaries use the full current dataset, not the filtered subset.
2. Show a task list with title, project, assignee, status, priority, and deadline.
3. Support case-insensitive substring search across title and assignee, a status filter including All, and a project filter including All. Combine all active filters using AND.
4. Support ascending and descending deadline sorting. Break ties by task ID ascending. Filtering and sorting must work together.
5. Provide a task-edit modal for title, assignee, status, priority (`low`, `medium`, `high`), and deadline. Project and ID are not editable. Reject blank/whitespace-only titles or assignees and invalid dates; show a useful validation message. Cancel must discard changes.
6. Saving updates every relevant task row and project/global summary immediately. A task can disappear from the current filtered view after an edit.
7. Persist saved edits in localStorage and restore them on reload. Handle malformed stored JSON or unavailable storage without crashing. Persisted edits should override the fixture, not duplicate its tasks.
8. Give the modal a programmatic name, move focus inside on open, keep Tab/Shift+Tab inside while open, close on Escape, and restore focus to the opener or a sensible fallback if it disappeared.
9. Include loading, fetch-error/retry, and no-matching-results states. A clear-filters action restores all tasks.
10. Work at 375 x 812 and 1440 x 900 CSS pixels without page-level horizontal overflow. All features must remain available at both sizes.

## Visual direction

A calm mission-control aesthetic: clear typography, restrained color, status badges, and one strong accent. Distinguish overdue work without relying only on color. A chart is optional and earns no credit by itself.

## Tests

Include meaningful tests for combined filtering, deadline sorting/ties, overdue calculation, progress calculation, and edit validation. Keep this initial version focused on the features above.
