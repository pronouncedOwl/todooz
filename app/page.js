import TodoApp from "@/components/TodoApp";
import { getProjects, getTodos } from "@/lib/db";
import { getTodayRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [todos, recurring, projects] = await Promise.all([
    getTodos(),
    getTodayRecurring(),
    getProjects(),
  ]);
  return (
    <TodoApp
      initialTodos={todos}
      initialRecurring={recurring}
      initialProjects={projects}
    />
  );
}
