"use server";

import { revalidatePath } from "next/cache";
import {
  createProject,
  createTodo,
  deleteTodo,
  setTodoCompleted,
  updateTodo,
  updateTodoNotes,
} from "@/lib/db";
import { setRecurringCompleted } from "@/lib/recurring";

function revalidateTodos() {
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function toggleTodo(id, completed) {
  await setTodoCompleted(id, completed);
  revalidateTodos();
}

export async function saveTodo(id, fields) {
  const todo = await updateTodo(id, fields);
  revalidateTodos();
  return todo;
}

export async function addTodo(fields) {
  const todo = await createTodo(fields);
  if (todo.project) {
    await createProject(todo.project);
  }
  revalidateTodos();
  return todo;
}

export async function saveNotes(todoId, notes) {
  const todo = await updateTodoNotes(todoId, notes);
  revalidateTodos();
  return todo;
}

export async function removeTodo(id) {
  await deleteTodo(id);
  revalidateTodos();
}

export async function addProject(name) {
  const project = await createProject(name);
  revalidateTodos();
  return project;
}

export async function toggleRecurring(id, completed) {
  await setRecurringCompleted(id, completed);
  revalidatePath("/");
}
