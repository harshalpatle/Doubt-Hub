import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-6 lg:px-10">
        <aside className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">DoubtHub</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ask questions, learn from others, and build confidence together.
            </p>
          </div>

          <nav className="flex flex-col gap-3">
            {['Home', 'Questions', 'Categories', 'Leaderboard', 'Bookmarks'].map((item) => (
              <button
                key={item}
                className="rounded-2xl px-4 py-3 text-left text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item}
              </button>
            ))}
          </nav>


          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              120 pts
            </span>
            <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Ask Question
            </button>
          </div>

        </aside>

        <main className="flex-1 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900">Ask doubts without fear.</h2>
                <p className="mt-2 max-w-2xl text-slate-600">
                  A friendly platform where students can ask questions, explore solutions, and help each other grow.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-blue-50 p-4 text-center">
                  <p className="text-sm text-slate-500">Questions solved</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">1.2k+</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 text-center">
                  <p className="text-sm text-slate-500">Active learners</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">850+</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.7fr_0.8fr]">
            <div className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Recent Questions</h3>
                  <p className="text-sm text-slate-500">Jump into the latest doubts from learners.</p>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2">
                  <input
                    type="search"
                    placeholder="Search questions"
                    className="flex-1 bg-transparent outline-none"
                  />
                  <span className="text-slate-400">🔍</span>
                </div>
              </div>


            </div>

            <aside className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Top Contributors</h3>
                <p className="text-sm text-slate-500">People who helped most this week.</p>
              </div>

              <button className="w-full rounded-3xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                View Leaderboard
              </button>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h4 className="text-lg font-semibold text-slate-900">Your Progress</h4>
                <p className="mt-3 text-sm text-slate-600">Level 2 – Novice</p>
                <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                  <span>120 / 250 pts</span>
                  <span>12 Questions answered</span>
                  <span>18 Answers contributed</span>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}

function QuestionCard({ subject, time, text, details, likes, answers }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-md">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{subject}</span>
        <span>{time}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-900">{text}</h3>
      <p className="mt-3 text-slate-600">{details}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">{likes} likes</span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">{answers} answers</span>
      </div>
    </article>
  );
}

function Contributor({ name, role, points }) {
  return (
    <li className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{role}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{points} pts</span>
      </div>
    </li>
  );
}

export default App;
