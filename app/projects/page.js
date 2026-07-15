import ProjectsApp from "@/components/ProjectsApp";
import { getProjects, getTodos } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects · Toodooz",
};

export default async function ProjectsPage() {
  const [todos, projects] = await Promise.all([getTodos(), getProjects()]);
  return <ProjectsApp initialTodos={todos} initialProjects={projects} />;
}
