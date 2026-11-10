/**
 * Timetable — weekly class schedules and bell timings.
 *
 * The screen is dedicated to the class timetable, period bell timings, breaks,
 * and teacher allocations, verified against real school classrooms and staff.
 */

import { Breadcrumb } from "./Breadcrumb";
import { TimetableView } from "./TimetableView";

export interface AcademicsViewProps {
  onBack: () => void;
}

export function AcademicsView({ onBack }: AcademicsViewProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb parent="Global Kids School" current="Timetable" onParentClick={onBack} />

      <div className="page-intro">
        <div>
          <p className="eyebrow">Academic Schedule</p>
          <h1 className="page-title">Timetable</h1>
          <p className="page-sub">
            Weekly class schedules, period bell timings, breaks, and teacher allocations across classes.
          </p>
        </div>
      </div>

      <TimetableView />
    </div>
  );
}
