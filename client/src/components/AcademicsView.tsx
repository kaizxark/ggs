/**
 * Academics — the timetable.
 *
 * The curriculum catalog, faculty allocation, homework board and performance
 * tabs were removed by request. The underlying tables (`subjects`,
 * `subject_teachers`, `assignments`, exam results) are untouched — other
 * screens and the database still use them — but this screen now does one job:
 * the class timetable, built and checked against the real school data.
 */

import { Breadcrumb } from "./Breadcrumb";
import { TimetableView } from "./TimetableView";

export interface AcademicsViewProps {
  onBack: () => void;
}

export function AcademicsView({ onBack }: AcademicsViewProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb parent="Global Kids School" current="Academics" onParentClick={onBack} />

      <div className="page-intro">
        <div>
          <p className="eyebrow">Timetable</p>
          <h1 className="page-title">Academics</h1>
        </div>
      </div>

      <TimetableView />
    </div>
  );
}
