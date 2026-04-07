import { useEffect, useState } from 'react';

const API_BASE = '/api';

function formatTime(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).toLocaleString('en-US', { 
    hour12: true, 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  });
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');
  const [authForm, setAuthForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [currentPage, setCurrentPage] = useState('home');
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [showAskModal, setShowAskModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ 
    subject: 'Computer Science', 
    title: '', 
    details: '' 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('doubthub-user') || 'null');
    if (storedUser) {
      setAuthUser(storedUser);
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadPageData(currentPage);
  }, [authUser, currentPage]);

  const saveUser = (user) => {
    localStorage.setItem('doubthub-user', JSON.stringify(user));
    setAuthUser(user);
  };

  const clearUser = () => {
    localStorage.removeItem('doubthub-user');
    setAuthUser(null);
  };

  const getAuthHeaders = () => {
    return authUser ? { 'x-user-id': authUser.id } : {};
  };

  const loadPageData = async (page) => {
    setLoading(true);
    try {
      if (page === 'home' || page === 'questions') {
        await fetchQuestions();
      }
      if (page === 'categories') {
        await fetchCategories();
      }
      if (page === 'leaderboard') {
        await fetchLeaderboard();
      }
      if (page === 'bookmarks' && authUser) {
        await fetchBookmarks();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE}/questions`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/categories`);
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      const data = await response.json();
      if (response.ok) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const response = await fetch(`${API_BASE}/bookmarks`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setBookmarks(data.bookmarks || []);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const fetchQuestionAnswers = async (questionId) => {
    try {
      const response = await fetch(`${API_BASE}/questions/${questionId}/answers`);
      const data = await response.json();
      if (response.ok) {
        setQuestionAnswers((current) => ({ 
          ...current, 
          [questionId]: data.answers 
        }));
      }
    } catch (error) {
      console.error('Failed to load answers:', error);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: authForm.email, 
          password: authForm.password 
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Login failed');
        return;
      }
      saveUser(data.user);
      setAuthForm({ 
        name: '', 
        email: '', 
        password: '', 
        confirmPassword: '' 
      });
      setCurrentPage('home');
    } catch (error) {
      setAuthMessage('Unable to login. Please try again.');
      console.error(error);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setAuthMessage('');

    if (!authForm.name || !authForm.email || !authForm.password) {
      setAuthMessage('Please fill all fields.');
      return;
    }

    if (authForm.password !== authForm.confirmPassword) {
      setAuthMessage('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: authForm.name, 
          email: authForm.email, 
          password: authForm.password 
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Signup failed');
        return;
      }
      saveUser(data.user);
      setAuthForm({ 
        name: '', 
        email: '', 
        password: '', 
        confirmPassword: '' 
      });
      setCurrentPage('home');
    } catch (error) {
      setAuthMessage('Unable to sign up. Please try again.');
      console.error(error);
    }
  };

  const handleLogout = () => {
    clearUser();
    setAuthForm({ 
      name: '', 
      email: '', 
      password: '', 
      confirmPassword: '' 
    });
    setAuthMode('login');
    setAuthMessage('');
    setCurrentPage('home');
    setQuestions([]);
    setLeaderboard([]);
    setBookmarks([]);
  };

  const handleAskQuestion = async (event) => {
    event.preventDefault();
    if (!newQuestion.title || !newQuestion.details) {
      setAuthMessage('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newQuestion),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Failed to post question');
        return;
      }
      setQuestions((current) => [data.question, ...current]);
      saveUser(data.user);
      setShowAskModal(false);
      setNewQuestion({ 
        subject: 'Computer Science', 
        title: '', 
        details: '' 
      });
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not post question');
      console.error('Could not post question:', error);
    }
  };

  const handleAnswerSubmit = async (questionId) => {
    const text = (answerDrafts[questionId] || '').trim();
    if (!text) return;

    try {
      const response = await fetch(`${API_BASE}/questions/${questionId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error(data.error);
        return;
      }

      setQuestions((current) =>
        current.map((question) =>
          question.id === questionId 
            ? { ...question, answers: question.answers + 1 } 
            : question
        )
      );
      setAnswerDrafts((current) => ({ ...current, [questionId]: '' }));
      setQuestionAnswers((current) => ({
        ...current,
        [questionId]: [data.answer, ...(current[questionId] || [])],
      }));
      saveUser(data.user);
    } catch (error) {
      console.error('Could not submit answer:', error);
    }
  };

  const handleBookmarkToggle = async (questionId, isBookmarked) => {
    try {
      if (isBookmarked) {
        await fetch(`${API_BASE}/bookmarks/${questionId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } else {
        await fetch(`${API_BASE}/bookmarks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ questionId }),
        });
      }
      await fetchQuestions();
      if (currentPage === 'bookmarks') {
        await fetchBookmarks();
      }
    } catch (error) {
      console.error('Bookmark error:', error);
    }
  };

  const toggleAnswers = async (questionId) => {
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
      return;
    }
    await fetchQuestionAnswers(questionId);
    setExpandedQuestion(questionId);
  };

  const filteredQuestions = questions.filter((question) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      question.title.toLowerCase().includes(query) ||
      question.details.toLowerCase().includes(query) ||
      question.subject.toLowerCase().includes(query) ||
      question.author.toLowerCase().includes(query)
    );
  });

  if (!authUser) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authMessage={authMessage}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-6 lg:px-10">
        <aside className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">DoubtHub</h1>
            <p className="mt-2 text-sm text-slate-500">
              Ask questions, learn from others, and grow together.
            </p>
          </div>

          <nav className="flex flex-col gap-3">
            {['Home', 'Questions', 'Categories', 'Leaderboard', 'Bookmarks'].map((item) => {
              const pageKey = item.toLowerCase();
              return (
                <button
                  key={item}
                  onClick={() => {
                    setCurrentPage(pageKey);
                    setSearchQuery('');
                    setExpandedQuestion(null);
                  }}
                  className={`rounded-2xl px-4 py-3 text-left transition ${
                    currentPage === pageKey
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Logged in as</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {authUser.name}
            </h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {authUser.role}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                {authUser.points} pts
              </span>
              <button
                onClick={() => setShowAskModal(true)}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Ask
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </aside>

        <main className="flex-1 space-y-6">
          {currentPage === 'home' && (
            <>
              <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-blue-600">
                      Welcome back
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                      Ask doubts without fear.
                    </h2>
                    <p className="mt-2 max-w-2xl text-slate-600">
                      Share your questions, answer others and earn points for 
                      every contribution.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-blue-50 p-4 text-center">
                      <p className="text-sm text-slate-500">
                        Questions available
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {questions.length}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 text-center">
                      <p className="text-sm text-slate-500">
                        Top contributors
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {leaderboard.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.7fr_0.8fr]">
                <QuestionsSection
                  questions={filteredQuestions}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  expandedQuestion={expandedQuestion}
                  questionAnswers={questionAnswers}
                  answerDrafts={answerDrafts}
                  toggleAnswers={toggleAnswers}
                  onDraftChange={(qid, text) =>
                    setAnswerDrafts((c) => ({ ...c, [qid]: text }))
                  }
                  onSubmitAnswer={handleAnswerSubmit}
                  onBookmarkToggle={handleBookmarkToggle}
                  loading={loading}
                />
                <LeaderboardWidget leaderboard={leaderboard} />
              </section>
            </>
          )}

          {currentPage === 'questions' && (
            <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">
                  All Questions
                </h2>
                <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2">
                  <input
                    type="search"
                    placeholder="Search"
                    value={searchQuery}
                    className="flex-1 bg-transparent outline-none"
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  <span className="text-slate-400">🔍</span>
                </div>
              </div>
              <QuestionsSection
                questions={filteredQuestions}
                searchQuery={searchQuery}
                setSearchQuery={() => {}}
                expandedQuestion={expandedQuestion}
                questionAnswers={questionAnswers}
                answerDrafts={answerDrafts}
                toggleAnswers={toggleAnswers}
                onDraftChange={(qid, text) =>
                  setAnswerDrafts((c) => ({ ...c, [qid]: text }))
                }
                onSubmitAnswer={handleAnswerSubmit}
                onBookmarkToggle={handleBookmarkToggle}
                loading={loading}
              />
            </section>
          )}

          {currentPage === 'categories' && (
            <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Categories
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm"
                  >
                    <p className="text-2xl font-semibold text-slate-900">
                      {cat.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {cat.count} questions
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {currentPage === 'leaderboard' && (
            <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Leaderboard
              </h2>
              <div className="space-y-3">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-blue-600 w-8">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="text-sm text-slate-500">{item.role}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                      {item.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {currentPage === 'bookmarks' && (
            <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Bookmarks
              </h2>
              <div className="space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {bookmarks.length > 0 ? (
                  bookmarks.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      answers={questionAnswers[question.id] || []}
                      expanded={expandedQuestion === question.id}
                      draft={answerDrafts[question.id] || ''}
                      onToggle={() => toggleAnswers(question.id)}
                      onDraftChange={(text) =>
                        setAnswerDrafts((current) => ({
                          ...current,
                          [question.id]: text,
                        }))
                      }
                      onSubmit={() => handleAnswerSubmit(question.id)}
                      onBookmarkToggle={() =>
                        handleBookmarkToggle(question.id, true)
                      }
                      bookmarked={true}
                      formattedTime={formatTime(question.createdAt)}
                    />
                  ))
                ) : (
                  <p className="text-center text-slate-500">No bookmarks yet</p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  Ask a new question
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Share your doubt and get help from the community.
                </p>
              </div>
              <button
                onClick={() => setShowAskModal(false)}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleAskQuestion}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Subject
                </span>
                <select
                  value={newQuestion.subject}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, subject: e.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option>Computer Science</option>
                  <option>Maths</option>
                  <option>Physics</option>
                  <option>Chemistry</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Question title
                </span>
                <input
                  value={newQuestion.title}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, title: e.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="Enter your question"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Details
                </span>
                <textarea
                  value={newQuestion.details}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, details: e.target.value })
                  }
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="Add more context"
                />
              </label>
              {authMessage && <p className="text-sm text-red-600">{authMessage}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Post question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthPage({ 
  authMode, 
  setAuthMode, 
  authForm, 
  setAuthForm, 
  authMessage, 
  onLogin, 
  onSignup 
}) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-blue-600 p-10 text-white sm:p-14">
            <h1 className="text-3xl font-semibold">Welcome to DoubtHub</h1>
            <p className="mt-4 text-slate-100/90">
              A safe community to ask questions, share answers, and learn faster 
              together.
            </p>
            <div className="mt-10 space-y-3 rounded-3xl bg-white/10 p-5 text-slate-200">
              <p className="font-semibold">Why DoubtHub?</p>
              <ul className="space-y-2 text-sm leading-6">
                <li>• Authenticate with email and password.</li>
                <li>• Post questions and answer other learners.</li>
                <li>• Earn points and climb the leaderboard.</li>
              </ul>
            </div>
          </div>

          <div className="p-10 sm:p-14">
            <div className="flex items-center gap-3 text-slate-900">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthForm({ 
                    name: '', 
                    email: '', 
                    password: '', 
                    confirmPassword: '' 
                  });
                }}
                className={`rounded-3xl px-5 py-3 text-sm font-semibold transition ${
                  authMode === 'login' 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setAuthForm({ 
                    name: '', 
                    email: '', 
                    password: '', 
                    confirmPassword: '' 
                  });
                }}
                className={`rounded-3xl px-5 py-3 text-sm font-semibold transition ${
                  authMode === 'signup' 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Sign up
              </button>
            </div>

            <form 
              onSubmit={authMode === 'login' ? onLogin : onSignup} 
              className="mt-8 space-y-5"
            >
              {authMode === 'signup' && (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Name
                  </span>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, name: event.target.value })
                    }
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                    placeholder="Your full name"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Email
                </span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="Enter your password"
                />
              </label>

              {authMode === 'signup' && (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Confirm Password
                  </span>
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={(event) =>
                      setAuthForm({ 
                        ...authForm, 
                        confirmPassword: event.target.value 
                      })
                    }
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                    placeholder="Repeat your password"
                  />
                </label>
              )}

              {authMessage && (
                <p className="text-sm text-red-600">{authMessage}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-3xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {authMode === 'login' 
                  ? 'Login to DoubtHub' 
                  : 'Create an account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionsSection({
  questions,
  searchQuery,
  setSearchQuery,
  expandedQuestion,
  questionAnswers,
  answerDrafts,
  toggleAnswers,
  onDraftChange,
  onSubmitAnswer,
  onBookmarkToggle,
  loading,
}) {
  return (
    <div className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div className="space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {loading ? (
          <p className="text-center text-slate-500">Loading questions...</p>
        ) : questions.length > 0 ? (
          questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              answers={questionAnswers[question.id] || []}
              expanded={expandedQuestion === question.id}
              draft={answerDrafts[question.id] || ''}
              onToggle={() => toggleAnswers(question.id)}
              onDraftChange={(text) => onDraftChange(question.id, text)}
              onSubmit={() => onSubmitAnswer(question.id)}
              onBookmarkToggle={() =>
                onBookmarkToggle(question.id, question.bookmarked)
              }
              bookmarked={question.bookmarked}
              formattedTime={formatTime(question.createdAt)}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
            No questions found.
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  answers,
  expanded,
  draft,
  onToggle,
  onDraftChange,
  onSubmit,
  onBookmarkToggle,
  bookmarked,
  formattedTime,
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
        <span>{question.subject}</span>
        <span>{formattedTime}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-900">
        {question.title}
      </h3>
      <p className="mt-3 text-slate-600">{question.details}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          {question.likes} likes
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          {question.answers} answers
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          {question.author}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onToggle}
          className="rounded-3xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {expanded ? 'Hide answers' : 'View answers'}
        </button>
        <button
          onClick={onBookmarkToggle}
          className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${
            bookmarked
              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {bookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
        </button>
      </div>

      {expanded && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            {answers.length > 0 ? (
              answers.map((answer) => (
                <div key={answer.id} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{answer.author}</p>
                  <p className="mt-2 text-slate-700">{answer.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No answers yet. Be the first!
              </p>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <textarea
              rows={3}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              placeholder="Write your answer here"
            />
            <button
              onClick={onSubmit}
              className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Post Answer
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function LeaderboardWidget({ leaderboard }) {
  return (
    <aside className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">
          Top Contributors
        </h3>
        <p className="text-sm text-slate-500">Highest scoring members.</p>
      </div>
      <ul className="space-y-3">
        {leaderboard.slice(0, 5).map((item, idx) => (
          <li
            key={item.id}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{idx + 1}. {item.role}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {item.points}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default App;