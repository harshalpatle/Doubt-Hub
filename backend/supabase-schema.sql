create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password text not null,
  points integer not null default 120,
  role text not null default 'Novice learner'
);

create table if not exists questions (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  subject text not null,
  title text not null,
  details text not null,
  created_at timestamptz not null default now(),
  likes integer not null default 0,
  answers integer not null default 0
);

create table if not exists answers (
  id serial primary key,
  question_id integer not null references questions(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists bookmarks (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  question_id integer not null references questions(id) on delete cascade,
  unique(user_id, question_id)
);