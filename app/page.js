import TodoApp from "@/components/TodoApp";
import { getProjects, getTodos } from "@/lib/db";
import { getHabitPrefs, getTodayRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [todos, recurring, projects, habitPrefs] = await Promise.all([
    getTodos(),
    getTodayRecurring(),
    getProjects(),
    getHabitPrefs(),
  ]);
  return (
    <TodoApp
      initialTodos={todos}
      initialRecurring={recurring}
      initialProjects={projects}
      morningClosedOn={habitPrefs.morning_closed_on}
    />
  );
}
