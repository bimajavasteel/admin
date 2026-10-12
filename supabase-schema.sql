create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'coordinator' check (role in ('admin','coordinator')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.status='approved');
$$;
create or replace function public.is_approved_user()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved');
$$;
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.profiles(id,email,role,status)
 values(new.id,coalesce(new.email,''),'coordinator','pending')
 on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created_ruangkinerja on auth.users;
create trigger on_auth_user_created_ruangkinerja after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create table if not exists public.employees (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 code text not null default '',
 department text not null default '',
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id)
);
alter table public.employees enable row level security;

create table if not exists public.employee_assignments (
 employee_id uuid not null references public.employees(id) on delete cascade,
 coordinator_id uuid not null references auth.users(id) on delete cascade,
 assigned_at timestamptz not null default now(),
 assigned_by uuid not null references auth.users(id),
 primary key(employee_id,coordinator_id)
);
alter table public.employee_assignments enable row level security;

create or replace function public.is_assigned_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.employee_assignments a
 where a.employee_id=target_employee and a.coordinator_id=(select auth.uid()));
$$;

drop policy if exists employees_read_assigned_or_admin on public.employees;
create policy employees_read_assigned_or_admin on public.employees for select to authenticated
using(public.is_admin() or (public.is_approved_user() and public.is_assigned_employee(id)));
create policy employees_admin_insert on public.employees for insert to authenticated with check(public.is_admin());
create policy employees_admin_update on public.employees for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy employees_admin_delete on public.employees for delete to authenticated using(public.is_admin());

create policy assignments_read_own_or_admin on public.employee_assignments for select to authenticated
using(public.is_admin() or coordinator_id=(select auth.uid()));
create policy assignments_admin_insert on public.employee_assignments for insert to authenticated with check(public.is_admin());
create policy assignments_admin_update on public.employee_assignments for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy assignments_admin_delete on public.employee_assignments for delete to authenticated using(public.is_admin());

create table if not exists public.evaluations (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id),
 evaluator_id uuid not null references auth.users(id),
 evaluator_name text not null default '',
 period text not null default '',
 evaluation_date date not null default current_date,
 status text not null default 'completed' check(status in ('draft','completed')),
 ratings jsonb not null default '{}'::jsonb,
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.evaluations enable row level security;
create policy evaluations_read_admin_or_own_assigned on public.evaluations for select to authenticated
using(public.is_admin() or (evaluator_id=(select auth.uid()) and public.is_approved_user() and public.is_assigned_employee(employee_id)));
create policy evaluations_insert_own_assigned on public.evaluations for insert to authenticated
with check(evaluator_id=(select auth.uid()) and public.is_approved_user() and public.is_assigned_employee(employee_id));
create policy evaluations_admin_update on public.evaluations for update to authenticated
using(public.is_admin()) with check(public.is_admin());
create policy evaluations_admin_delete on public.evaluations for delete to authenticated using(public.is_admin());

-- 1) Login pertama menggunakan Google dengan satriabimauin@gmail.com.
-- 2) Setelah login, jalankan query ini untuk mengangkat akun tersebut sebagai admin.
insert into public.profiles(id,email,role,status,approved_at)
select id,email,'admin','approved',now() from auth.users
where lower(email)=lower('satriabimauin@gmail.com')
on conflict(id) do update set role='admin',status='approved',approved_at=now(),email=excluded.email;
