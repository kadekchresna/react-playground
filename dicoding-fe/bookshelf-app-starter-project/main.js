
let completedBooks = [];
let ongoingBooks = [];

const LOCAL_STORAGE_COMPLETED_BOOKS = "LOCAL_STORAGE_COMPLETED_BOOKS";
const LOCAL_STORAGE_ONGOING_BOOKS = "LOCAL_STORAGE_ONGOING_BOOKS";

document.addEventListener('DOMContentLoaded', () => {


  const ongoingBooksList = document.getElementById('incompleteBookList');
  const completedBooksList = document.getElementById('completeBookList');

  if (typeof (Storage) !== 'undefined') {
    if (!localStorage.getItem(LOCAL_STORAGE_COMPLETED_BOOKS)) {
      localStorage.setItem(LOCAL_STORAGE_COMPLETED_BOOKS, JSON.stringify([]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_ONGOING_BOOKS)) {
      localStorage.setItem(LOCAL_STORAGE_ONGOING_BOOKS, JSON.stringify([]));
    }

    completedBooks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COMPLETED_BOOKS)) || [];
    ongoingBooks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ONGOING_BOOKS)) || [];
    render(completedBooks, completedBooksList);
    render(ongoingBooks, ongoingBooksList);
  } else {
    alert("Browser yang Anda gunakan tidak mendukung Web Storage");
  }


  // form add book
  const addBookSubmitButton = document.getElementById('bookFormSubmit');
  const formAddBook = document.getElementById('bookForm');
  addBookSubmitButton.addEventListener('click', (event) => {
    event.preventDefault();


    id = new Date().getTime();

    const inputBookTitle = document.getElementById('bookFormTitle').value.trim();
    const inputBookAuthor = document.getElementById('bookFormAuthor').value.trim();
    const inputBookFormYear = document.getElementById('bookFormYear').value.trim();
    const inputBookFormIsComplete = document.getElementById('bookFormIsComplete').checked;


    if (!inputBookTitle || !inputBookAuthor || !inputBookFormYear) {
      return
    }

    const book = {
      id: id,
      title: inputBookTitle,
      author: inputBookAuthor,
      year: +inputBookFormYear,
      isComplete: inputBookFormIsComplete,
    }


    if (inputBookFormIsComplete) {
      completedBooks.push(book);
      setLocalStorage(completedBooks, LOCAL_STORAGE_COMPLETED_BOOKS);
      render(completedBooks, completedBooksList);

    } else {
      ongoingBooks.push(book);
      setLocalStorage(ongoingBooks, LOCAL_STORAGE_ONGOING_BOOKS);
      render(ongoingBooks, ongoingBooksList);
    }

    formAddBook.reset();

  })


  // book ongoing read
  // completed read
  const searchSubmitButton = document.getElementById('searchSubmit');
  searchSubmitButton.addEventListener('click', (event) => {
    event.preventDefault();
    const inputSearchTitle = document.getElementById('searchBookTitle').value;
    let [resultCompletedBooks, resultOngoingBooks] = searchBook(inputSearchTitle);


    render(resultCompletedBooks, completedBooksList);
    render(resultOngoingBooks, ongoingBooksList);

  })


  ongoingBooksList.addEventListener('click', (event) => {

    const action = event.target.dataset.action;
    const id = +event.target.dataset.id;
    const isComplete = event.target.dataset.complete == 'true';

    if (!action || !id) return;

    switch (action) {
      case 'delete':
        deleteBooks(id, isComplete);

        if (isComplete) {
          render(completedBooks, completedBooksList);
          break;
        }

        render(ongoingBooks, ongoingBooksList);
        break;

      case 'edit':
        const divBook = document.getElementById(id);
        const book = ongoingBooks.filter((b) => b.id === id)[0];

        renderEditForm(book, divBook);
        break;

      case 'complete':
        updateStatusBooks(id, !isComplete);

        render(completedBooks, completedBooksList);
        render(ongoingBooks, ongoingBooksList);
        break;

      default:
        break;
    }

  })

  completedBooksList.addEventListener('click', (event) => {

    const action = event.target.dataset.action;
    const id = +event.target.dataset.id;
    const isComplete = event.target.dataset.complete;

    if (!action || !id) return;

    switch (action) {
      case 'delete':
        deleteBooks(id, isComplete);

        if (isComplete) {
          render(completedBooks, completedBooksList);
          break;
        }

        render(ongoingBooks, ongoingBooksList);
        break;

      case 'edit':
        const divBook = document.getElementById(id);
        const book = completedBooks.filter((b) => b.id === id)[0];

        renderEditForm(book, divBook);
        break;

      case 'complete':
        updateStatusBooks(id, !isComplete);

        render(completedBooks, completedBooksList);
        render(ongoingBooks, ongoingBooksList);
        break;

      default:
        break;
    }

  })

})

function render(books, list) {
  list.innerHTML = ``


  for (const book of books) {

    const divBook = document.createElement('div');
    divBook.setAttribute('data-bookid', book.id);
    divBook.setAttribute('id', book.id);
    divBook.setAttribute('data-testid', "bookItem");

    const titleBook = document.createElement('h3');
    titleBook.setAttribute('data-testid', "bookItemTitle");
    titleBook.textContent = book.title;


    const authorBook = document.createElement('p');
    authorBook.setAttribute('data-testid', "bookItemAuthor");
    authorBook.textContent = `Penulis: ${book.author}`;

    const yearFromBook = document.createElement('p');
    yearFromBook.setAttribute('data-testid', "bookItemYear");
    yearFromBook.textContent = `Tahun: ${book.year}`;


    const divButtonBook = document.createElement('div');
    divButtonBook.setAttribute('id', 'buttonBook')

    const isCompleteButton = document.createElement('button');
    isCompleteButton.setAttribute('data-testid', "bookItemIsCompleteButton");
    isCompleteButton.setAttribute('data-action', 'complete');
    isCompleteButton.setAttribute('id', 'buttonCompleteBook');
    isCompleteButton.setAttribute('data-id', book.id);
    isCompleteButton.setAttribute('data-complete', book.isComplete);

    if (book.isComplete) {
      isCompleteButton.textContent = 'Baca kembali';
    } else {
      isCompleteButton.textContent = 'Selesai dibaca';
    }

    const deleteButton = document.createElement('button');
    deleteButton.setAttribute('data-testid', "bookItemDeleteButton");
    deleteButton.setAttribute('data-action', 'delete');
    deleteButton.setAttribute('id', 'buttonDeleteBook');
    deleteButton.setAttribute('data-id', book.id);
    deleteButton.setAttribute('data-complete', book.isComplete);;
    deleteButton.textContent = 'Hapus Buku';

    const editButton = document.createElement('button');
    editButton.setAttribute('data-testid', "bookItemEditButton");
    editButton.setAttribute('data-action', 'edit');
    editButton.setAttribute('data-id', book.id);
    editButton.setAttribute('data-complete', book.isComplete);;
    editButton.textContent = 'Edit Buku';

    divButtonBook.appendChild(isCompleteButton);
    divButtonBook.appendChild(deleteButton);
    divButtonBook.appendChild(editButton);

    divBook.appendChild(titleBook);
    divBook.appendChild(authorBook);
    divBook.appendChild(yearFromBook);
    divBook.appendChild(divButtonBook);

    list.appendChild(divBook)

  }
}




function renderEditForm(book, list) {
  list.innerHTML = ``

  const inputTitleBook = document.createElement('input');
  inputTitleBook.setAttribute("id", "editInputTitleBook");
  inputTitleBook.type = "text";
  inputTitleBook.value = book.title;

  const divInputAuthor = document.createElement('div');
  const labelAuthor = document.createElement('label');
  labelAuthor.innerText = "Penulis: ";

  const inputAuthorBook = document.createElement('input');
  inputAuthorBook.setAttribute("id", "editInputAuthorBook");
  inputAuthorBook.type = "text";
  inputAuthorBook.value = book.author;

  divInputAuthor.appendChild(labelAuthor);
  divInputAuthor.appendChild(inputAuthorBook);

  const divInputYearBook = document.createElement('div');
  const labelYearBook = document.createElement('label');
  labelYearBook.innerText = "Tahun: ";

  const inputYearBook = document.createElement('input');
  inputYearBook.setAttribute("id", "editInputYearBook");
  inputYearBook.type = "number";
  inputYearBook.value = book.year;

  divInputYearBook.appendChild(labelYearBook);
  divInputYearBook.appendChild(inputYearBook);

  const divButtonBook = document.createElement('div');
  divButtonBook.setAttribute('id', 'buttonEditBook');

  const submitButton = document.createElement('button');
  submitButton.setAttribute('data-action', 'save');
  submitButton.setAttribute('data-id', book.id);
  submitButton.setAttribute('id', "buttonEditSubmit");
  submitButton.setAttribute('data-complete', book.isComplete);
  submitButton.textContent = 'Simpan';


  const ongoingBooksList = document.getElementById('incompleteBookList');
  const completedBooksList = document.getElementById('completeBookList');

  submitButton.addEventListener('click', (event) => {

    if (!inputTitleBook.value.trim() || !inputYearBook.value.trim() || !inputAuthorBook.value.trim()) {
      return;
    }
    event.preventDefault();
    if (book.isComplete) {
      const index = completedBooks.findIndex((b) => b.id === book.id);
      completedBooks[index].title = inputTitleBook.value;
      completedBooks[index].year = +inputYearBook.value;
      completedBooks[index].author = inputAuthorBook.value;

      setLocalStorage(completedBooks, LOCAL_STORAGE_COMPLETED_BOOKS);

      render(completedBooks, completedBooksList);

    } else {
      const index = ongoingBooks.findIndex((b) => b.id === book.id);
      ongoingBooks[index].title = inputTitleBook.value;
      ongoingBooks[index].year = +inputYearBook.value;
      ongoingBooks[index].author = inputAuthorBook.value;

      setLocalStorage(ongoingBooks, LOCAL_STORAGE_ONGOING_BOOKS);

      render(ongoingBooks, ongoingBooksList);
    }
  })

  const cancelButton = document.createElement('button');
  cancelButton.setAttribute('data-action', 'cancel');
  cancelButton.setAttribute('data-id', book.id);
  cancelButton.setAttribute('id', "buttonEditCancel");
  cancelButton.setAttribute('data-complete', book.isComplete);;
  cancelButton.textContent = 'Batal';


  cancelButton.addEventListener('click', () => {
    if (book.isComplete) {
      render(completedBooks, completedBooksList);
    } else {
      render(ongoingBooks, ongoingBooksList);
    }
  })

  divButtonBook.appendChild(submitButton);
  divButtonBook.appendChild(cancelButton);

  list.appendChild(inputTitleBook);
  list.appendChild(divInputAuthor);
  list.appendChild(divInputYearBook);
  list.appendChild(divButtonBook);



}

function setLocalStorage(books, key) {
  if (typeof (Storage) !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(books));
  }
}

function updateBooks(id, title, author, year, isComplete) {

  if (isComplete) {
    const index = completedBooks.findIndex((b) => b.id === id);
    if (index >= 0) {
      completedBooks[index].title = title;
      completedBooks[index].author = author;
      completedBooks[index].year = year;
    }

    setLocalStorage(completedBooks, LOCAL_STORAGE_COMPLETED_BOOKS);
    return
  }

  const index = ongoingBooks.findIndex((b) => b.id === id);
  if (index >= 0) {
    ongoingBooks[index].title = title;
    ongoingBooks[index].author = author;
    ongoingBooks[index].year = year;
  }

  setLocalStorage(ongoingBooks, LOCAL_STORAGE_ONGOING_BOOKS);
  return
}

function deleteBooks(id, isComplete) {
  if (isComplete) {
    completedBooks = completedBooks.filter((book) => book.id !== id);
    setLocalStorage(completedBooks, LOCAL_STORAGE_COMPLETED_BOOKS);
    return
  }

  ongoingBooks = ongoingBooks.filter((book) => book.id !== id);

  setLocalStorage(ongoingBooks, LOCAL_STORAGE_ONGOING_BOOKS);
  return
}


function updateStatusBooks(id, isComplete) {

  if (isComplete) {

    const index = ongoingBooks.findIndex((b) => b.id === id);
    if (index >= 0) {
      const b = {
        id: id,
        title: ongoingBooks[index].title,
        author: ongoingBooks[index].author,
        year: ongoingBooks[index].year,
        isComplete: true,
      }
      completedBooks.push(b);
      setLocalStorage(completedBooks, LOCAL_STORAGE_COMPLETED_BOOKS);

    }

    deleteBooks(id, !isComplete);
    return
  }

  const index = completedBooks.findIndex((b) => b.id === id);
  if (index >= 0) {
    const b = {
      id: id,
      title: completedBooks[index].title,
      author: completedBooks[index].author,
      year: completedBooks[index].year,
      isComplete: false,
    }
    ongoingBooks.push(b);
    setLocalStorage(ongoingBooks, LOCAL_STORAGE_ONGOING_BOOKS);
  }

  deleteBooks(id, !isComplete);
  return
}

function searchBook(title) {
  const filteredCompletedBooks = completedBooks.filter((b) => b.title.includes(title));
  const filteredOngoingBooks = ongoingBooks.filter((b) => b.title.includes(title));

  return [filteredCompletedBooks, filteredOngoingBooks];
}