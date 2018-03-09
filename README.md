# Fnote

Fnote is a self-hosted and web-based notetaking application built on Python 2.7 and Flask. Its data are stored in human-readable Markdown files, which can easily be edited directly on your machine/server as well.

# Installation

Fnote requires that you have Python 2.7 installed.

Fnote also has three library dependencies. You can install them using pip:

	pip install -r requirements.txt

# Running Fnote

You can run the server using the default settings easily:

    python fnote.py

Flask will run a web server that is only accessible to you locally (unless you tell it otherwise).

## Host publicly or within your network

To make the server public, run

	set FLASK_APP=fnote.py
	flask run --host=0.0.0.0

## Host using WSGI

## Authentication

If you want to restrict access to your notes, enable HTTP authentication by setting `username` and `password` in fnote.py. If they are empty strings (the default), HTTP authentication is disabled.

# Features

*   WYSIWYG editor.
*   Instantaneously search files (and titles).
*   Files can be edited locally.
*   Lists recently edited notes (based on file mod timestamp).
*   Responsive UI. Rename notes, delete notes, create notebooks, etc.
*   Files are saved automatically as you edit them.
*   Etc.

## How notes are stored

The notes use Markdown syntax and are stored in the *notes/* directory in the application directory itself. Each note belongs to a notebook, which simply corresponds to a directory on your hard drive.

## Screenshots

<a href="//dlon.github.io/fnote/editing.PNG" title="Editing a note"><img src="https://dlon.github.io/fnote/editing.PNG" width="50%" /></a> <a href="//dlon.github.io/fnote/searchAndRecent.PNG" title="Searching & recent notes"><img src="https://dlon.github.io/fnote/searchAndRecent.PNG" width="50%" /></a> <a href="//dlon.github.io/fnote/createNote.PNG" title="Creating a note"><img src="https://dlon.github.io/fnote/createNote.PNG" width="50%" /></a> <a href="//dlon.github.io/fnote/createNotebook.PNG" title="Creating a notebook"><img src="https://dlon.github.io/fnote/createNotebook.PNG" width="50%" /></a>
