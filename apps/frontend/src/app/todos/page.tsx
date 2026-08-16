import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function TodosPage() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from('todos').select();

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto bg-slate-50 text-slate-900">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Supabase Todos</h1>
      {todos && todos.length > 0 ? (
        <ul className="space-y-2">
          {todos.map((todo: any) => (
            <li
              key={todo.id}
              className="p-3 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-sm"
            >
              {todo.name || todo.title || JSON.stringify(todo)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-6 rounded-xl bg-white border border-slate-200 text-slate-500 text-sm shadow-sm">
          No todos found in your Supabase table.
        </div>
      )}
    </div>
  );
}
