import { useOutletContext } from "react-router-dom";
import TutorChat from "../features/tutor/TutorChat.jsx";

export default function ProjectTutorPage() {
  const { project } = useOutletContext();

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[32rem] flex-col">
      <TutorChat projectId={project.id} />
    </div>
  );
}
