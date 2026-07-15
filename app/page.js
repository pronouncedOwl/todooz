import TodoApp from "@/components/TodoApp";
import { getTodos } from "@/lib/db";
import { getTodayRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [todos, recurring] = await Promise.all([
    getTodos(),
    getTodayRecurring(),
  ]);
  return <TodoApp initialTodos={todos} initialRecurring={recurring} />;
}
