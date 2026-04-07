import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

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
  const [questionEditModal, setQuestionEditModal] = useState({
    open: false,
    question: null,
    title: '',
    details: '',
  });
  const [answerEditModal, setAnswerEditModal] = useState({
    open: false,
    questionId: null,
    answerId: null,
    text: '',
  });
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
      const response = await fetch(`${API_BASE}/questions/${questionId}/answers`, {
        headers: getAuthHeaders(),
      });
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

  const handleAnswerLikeToggle = async (questionId, answer) => {
    try {
      const method = answer.likedByUser ? 'DELETE' : 'POST';
      const response = await fetch(`${API_BASE}/answers/${answer.id}/like`, {
        method,
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Could not update like');
        return;
      }

      setQuestionAnswers((current) => ({
        ...current,
        [questionId]: (current[questionId] || []).map((item) =>
          item.id === answer.id
            ? { ...item, likes: data.answer.likes, likedByUser: data.answer.likedByUser }
            : item
        ),
      }));
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not update like');
      console.error(error);
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

  const openQuestionEditModal = (question) => {
    setQuestionEditModal({
      open: true,
      question,
      title: question.title,
      details: question.details,
    });
  };

  const openAnswerEditModal = (questionId, answer) => {
    setAnswerEditModal({
      open: true,
      questionId,
      answerId: answer.id,
      text: answer.text,
    });
  };

  const handleEditQuestion = async (event) => {
    event.preventDefault();
    if (!questionEditModal.question) return;
    const title = questionEditModal.title.trim();
    const details = questionEditModal.details.trim();
    if (!title || !details) {
      setAuthMessage('Please fill title and details');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/questions/${questionEditModal.question.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          subject: questionEditModal.question.subject,
          title,
          details,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Failed to edit question');
        return;
      }

      setQuestions((current) =>
        current.map((item) => (item.id === questionEditModal.question.id ? data.question : item))
      );
      setBookmarks((current) =>
        current.map((item) => (item.id === questionEditModal.question.id ? data.question : item))
      );
      setQuestionEditModal({ open: false, question: null, title: '', details: '' });
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not edit question');
      console.error(error);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    const confirmed = window.confirm('Delete this question? This will also remove its answers.');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/questions/${questionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Failed to delete question');
        return;
      }

      setQuestions((current) => current.filter((item) => item.id !== questionId));
      setBookmarks((current) => current.filter((item) => item.id !== questionId));
      setQuestionAnswers((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
      if (expandedQuestion === questionId) {
        setExpandedQuestion(null);
      }
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not delete question');
      console.error(error);
    }
  };

  const handleEditAnswer = async (event) => {
    event.preventDefault();
    if (!answerEditModal.answerId || !answerEditModal.questionId) return;
    const text = answerEditModal.text.trim();
    if (!text) {
      setAuthMessage('Answer cannot be empty');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/answers/${answerEditModal.answerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Failed to edit answer');
        return;
      }

      setQuestionAnswers((current) => ({
        ...current,
        [answerEditModal.questionId]: (current[answerEditModal.questionId] || []).map((item) =>
          item.id === answerEditModal.answerId ? { ...item, text: data.answer.text } : item
        ),
      }));
      setAnswerEditModal({ open: false, questionId: null, answerId: null, text: '' });
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not edit answer');
      console.error(error);
    }
  };

  const handleDeleteAnswer = async (questionId, answerId) => {
    const confirmed = window.confirm('Delete this answer?');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/answers/${answerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error || 'Failed to delete answer');
        return;
      }

      setQuestionAnswers((current) => ({
        ...current,
        [questionId]: (current[questionId] || []).filter((item) => item.id !== answerId),
      }));
      setQuestions((current) =>
        current.map((item) =>
          item.id === questionId ? { ...item, answers: Math.max(0, item.answers - 1) } : item
        )
      );
      setBookmarks((current) =>
        current.map((item) =>
          item.id === questionId ? { ...item, answers: Math.max(0, item.answers - 1) } : item
        )
      );
      setAuthMessage('');
    } catch (error) {
      setAuthMessage('Could not delete answer');
      console.error(error);
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
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#edf4ff_45%,_#f6f8fc_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-50 [background-image:radial-gradient(rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 lg:p-6 lg:px-10">
        <aside className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-8 rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg shadow-slate-900/20">
            <h1 className="text-2xl font-semibold tracking-tight text-white">DoubtHub</h1>
            <p className="mt-2 text-sm text-slate-300">
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
                  className={`rounded-2xl px-4 py-3 text-left font-medium transition duration-200 ${
                    currentPage === pageKey
                      ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 rounded-[1.75rem] border border-slate-200/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Logged in as</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
              {authUser.name}
            </h2>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              {authUser.role}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-medium text-white shadow-md shadow-slate-950/20">
                {authUser.points} pts
              </span>
              <button
                onClick={() => setShowAskModal(true)}
                className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:from-blue-500 hover:to-cyan-400"
              >
                Ask
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition hover:bg-slate-50"
          >
            Logout
          </button>
        </aside>

        <main className="flex-1 space-y-6">
          {currentPage === 'home' && (
            <>
              <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-blue-600">
                      Welcome back
                    </p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                      Ask doubts without fear.
                    </h2>
                    <p className="mt-3 max-w-2xl text-slate-600">
                      Share your questions, answer others and earn points for 
                      every contribution.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-blue-50 to-sky-100 p-4 text-center shadow-sm">
                      <p className="text-sm text-slate-500">
                        Questions available
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">
                        {questions.length}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-white to-slate-50 p-4 text-center shadow-sm">
                      <p className="text-sm text-slate-500">
                        Top contributors
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">
                        {leaderboard.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.7fr_0.8fr]">
                <QuestionsSection
                  questions={filteredQuestions}
                  authUser={authUser}
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
                  onEditQuestion={openQuestionEditModal}
                  onDeleteQuestion={handleDeleteQuestion}
                  onEditAnswer={openAnswerEditModal}
                  onDeleteAnswer={handleDeleteAnswer}
                  onAnswerLikeToggle={handleAnswerLikeToggle}
                  loading={loading}
                />
                <LeaderboardWidget leaderboard={leaderboard} authUser={authUser} />
              </section>
            </>
          )}

          {currentPage === 'questions' && (
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  All Questions
                </h2>
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
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
                authUser={authUser}
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
                onEditQuestion={openQuestionEditModal}
                onDeleteQuestion={handleDeleteQuestion}
                onEditAnswer={openAnswerEditModal}
                onDeleteAnswer={handleDeleteAnswer}
                onAnswerLikeToggle={handleAnswerLikeToggle}
                loading={loading}
              />
            </section>
          )}

          {currentPage === 'categories' && (
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-950">
                Categories
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="rounded-[1.5rem] border border-slate-200/70 bg-white p-6 text-center shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-slate-950">
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
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-950">
                Leaderboard
              </h2>
              <div className="space-y-3">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-[1.5rem] border border-slate-200/70 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-blue-600 w-8">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.role}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2 text-sm font-semibold text-blue-700">
                      {item.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {currentPage === 'bookmarks' && (
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-950">
                Bookmarks
              </h2>
              <div className="space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {bookmarks.length > 0 ? (
                  bookmarks.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      authUser={authUser}
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
                      onEditQuestion={() => openQuestionEditModal(question)}
                      onDeleteQuestion={() => handleDeleteQuestion(question.id)}
                      onEditAnswer={(answer) => openAnswerEditModal(question.id, answer)}
                      onDeleteAnswer={(answerId) => handleDeleteAnswer(question.id, answerId)}
                      onAnswerLikeToggle={(answer) => handleAnswerLikeToggle(question.id, answer)}
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

      {authMessage && authUser && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="text-blue-600">Info</span>
            <p className="flex-1">{authMessage}</p>
            <button
              onClick={() => setAuthMessage('')}
              className="text-slate-400 transition hover:text-slate-700"
            >
              x
            </button>
          </div>
        </div>
      )}

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
                  <option>General</option>
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

      {questionEditModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-slate-900">Edit question</h3>
              <button
                onClick={() => setQuestionEditModal({ open: false, question: null, title: '', details: '' })}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleEditQuestion}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={questionEditModal.title}
                  onChange={(e) => setQuestionEditModal((s) => ({ ...s, title: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="Enter question title"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Details</span>
                <textarea
                  value={questionEditModal.details}
                  onChange={(e) => setQuestionEditModal((s) => ({ ...s, details: e.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="Add details"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuestionEditModal({ open: false, question: null, title: '', details: '' })}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {answerEditModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-slate-900">Edit answer</h3>
              <button
                onClick={() => setAnswerEditModal({ open: false, questionId: null, answerId: null, text: '' })}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleEditAnswer}>
              <textarea
                value={answerEditModal.text}
                onChange={(e) => setAnswerEditModal((s) => ({ ...s, text: e.target.value }))}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                placeholder="Edit your answer"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAnswerEditModal({ open: false, questionId: null, answerId: null, text: '' })}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Update answer
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
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_35px_100px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-900 to-cyan-700 p-10 text-white sm:p-14">
            <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100">
                DoubtHub
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">Learn Better, Faster</h1>
              <p className="mt-4 max-w-md text-slate-200/95">
                Ask doubts without hesitation, get guided answers, and build your confidence one question at a time.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                  <p className="text-xl font-semibold">24/7</p>
                  <p className="text-xs text-slate-200">Active Feed</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                  <p className="text-xl font-semibold">Fast</p>
                  <p className="text-xs text-slate-200">Answers</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                  <p className="text-xl font-semibold">+Points</p>
                  <p className="text-xs text-slate-200">Grow Rank</p>
                </div>
              </div>

              <div className="mt-8 space-y-3 rounded-3xl border border-white/15 bg-white/10 p-5 text-slate-100">
                <p className="font-semibold">Why students love it</p>
                <ul className="space-y-2 text-sm leading-6 text-slate-100/90">
                  <li>• Clean feed for doubts and answers.</li>
                  <li>• Track your growth with points.</li>
                  <li>• Save useful questions in bookmarks.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10 lg:p-14">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {authMode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {authMode === 'login'
                  ? 'Log in to continue your learning journey.'
                  : 'Join the community and start asking questions.'}
              </p>
            </div>

            <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 text-slate-900 shadow-inner">
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
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  authMode === 'login' 
                    ? 'bg-white text-slate-900 shadow' 
                    : 'text-slate-600'
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
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  authMode === 'signup' 
                    ? 'bg-white text-slate-900 shadow' 
                    : 'text-slate-600'
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Repeat your password"
                  />
                </label>
              )}

              {authMode === 'signup' && (
                <p className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Tip: Use at least 8 characters for a stronger password.
                </p>
              )}

              {authMessage && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{authMessage}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:translate-y-[-1px] hover:from-blue-500 hover:to-cyan-400"
              >
                {authMode === 'login' 
                  ? 'Login to DoubtHub' 
                  : 'Create an account'}
              </button>

              <p className="text-center text-xs text-slate-400">
                By continuing, you agree to respectful community guidelines.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionsSection({
  questions,
  authUser,
  searchQuery,
  setSearchQuery,
  expandedQuestion,
  questionAnswers,
  answerDrafts,
  toggleAnswers,
  onDraftChange,
  onSubmitAnswer,
  onBookmarkToggle,
  onEditQuestion,
  onDeleteQuestion,
  onEditAnswer,
  onDeleteAnswer,
  onAnswerLikeToggle,
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
              authUser={authUser}
              answers={questionAnswers[question.id] || []}
              expanded={expandedQuestion === question.id}
              draft={answerDrafts[question.id] || ''}
              onToggle={() => toggleAnswers(question.id)}
              onDraftChange={(text) => onDraftChange(question.id, text)}
              onSubmit={() => onSubmitAnswer(question.id)}
              onEditQuestion={() => onEditQuestion(question)}
              onDeleteQuestion={() => onDeleteQuestion(question.id)}
              onEditAnswer={(answer) => onEditAnswer(question.id, answer)}
              onDeleteAnswer={(answerId) => onDeleteAnswer(question.id, answerId)}
              onAnswerLikeToggle={(answer) => onAnswerLikeToggle(question.id, answer)}
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
  authUser,
  answers,
  expanded,
  draft,
  onToggle,
  onDraftChange,
  onSubmit,
  onEditQuestion,
  onDeleteQuestion,
  onEditAnswer,
  onDeleteAnswer,
  onAnswerLikeToggle,
  onBookmarkToggle,
  bookmarked,
  formattedTime,
}) {
  const canManageQuestion = authUser && Number(authUser.id) === Number(question.userId);

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
        {canManageQuestion && (
          <>
            <button
              onClick={onEditQuestion}
              className="rounded-3xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-200"
            >
              Edit
            </button>
            <button
              onClick={onDeleteQuestion}
              className="rounded-3xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200"
            >
              Delete
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            {answers.length > 0 ? (
              answers.map((answer) => (
                <div key={answer.id} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{answer.author}</p>
                  <p className="mt-2 text-slate-700">{answer.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => onAnswerLikeToggle(answer)}
                      className={`rounded-3xl px-3 py-1 text-xs font-semibold transition ${
                        answer.likedByUser
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {answer.likedByUser ? 'Liked' : 'Like'}
                    </button>
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">
                      {answer.likes || 0} likes
                    </span>
                  </div>
                  {authUser && Number(authUser.id) === Number(answer.userId) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => onEditAnswer(answer)}
                        className="rounded-3xl bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 transition hover:bg-green-200"
                      >
                        Edit Answer
                      </button>
                      <button
                        onClick={() => onDeleteAnswer(answer.id)}
                        className="rounded-3xl bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-200"
                      >
                        Delete Answer
                      </button>
                    </div>
                  )}
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

function LeaderboardWidget({ leaderboard, authUser }) {
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