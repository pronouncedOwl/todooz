"use server";

import { revalidatePath } from "next/cache";
import {
  createProject,
  createTodo,
  deleteProject,
  deleteTodo,
  makeTodoIntoProject,
  setTodoCompleted,
  updateTodo,
  updateTodoNotes,
} from "@/lib/db";
import {
  createRecurringTemplate,
  deleteRecurringTemplate,
  promoteTodoToRecurring,
  resolveMorningLeftovers,
  setRecurringCompleted,
  setRecurringSkipped,
  updateRecurringTemplate,
} from "@/lib/recurring";

function revalidateTodos() {
  revalidatePath("/");
  revalidatePath("/projects");
}

function revalidateRecurring() {
  revalidatePath("/");
  revalidatePath("/export");
}

export async function toggleTodo(id, completed) {
  await setTodoCompleted(id, completed);
  revalidateTodos();
}

export async function saveTodo(id, fields) {
  const todo = await updateTodo(id, fields);
  if (todo.project) {
    await createProject(todo.project);
  }
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

export async function removeProject(name) {
  const result = await deleteProject(name);
  revalidateTodos();
  return result;
}

export async function convertTodoToProject(todoId) {
  const todo = await makeTodoIntoProject(todoId);
  revalidateTodos();
  return todo;
}

export async function toggleRecurring(id, completed) {
  await setRecurringCompleted(id, completed);
  revalidatePath("/");
}

export async function skipRecurring(id) {
  await setRecurringSkipped(id);
  revalidatePath("/");
}

export async function closeMorningBlock(resolution) {
  const result = await resolveMorningLeftovers(resolution);
  revalidatePath("/");
  return result;
}

export async function addRecurring(fields) {
  const template = await createRecurringTemplate(fields);
  revalidateRecurring();
  return template;
}

export async function saveRecurring(templateId, fields) {
  const template = await updateRecurringTemplate(templateId, fields);
  revalidateRecurring();
  return template;
}

export async function stopRecurring(templateId) {
  const result = await deleteRecurringTemplate(templateId);
  revalidateRecurring();
  return result;
}

export async function makeTodoRecurring(todoId, scheduleFields) {
  const template = await promoteTodoToRecurring(todoId, scheduleFields);
  revalidateTodos();
  revalidatePath("/export");
  return template;
}
