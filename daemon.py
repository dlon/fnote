# -*- coding: utf-8 -*-
from flask import Flask
import flask
app = Flask('freenote')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # FIXME: remove. for instantaneous updates

import os
import shutil
import re
import glob
import markdown
import html2markdown

# set user and password to enable HTTP basic authentication
from functools import wraps
username = 'admin'
password = 'pass'

numberOfRecentNotes = 7

def check_auth(user, pass_):
	"""This function is called to check if a username /
	password combination is valid.
	"""
	return user == username and pass_ == password

def authenticate():
	"""Sends a 401 response that enables basic auth"""
	return flask.Response(
		'Could not verify your access level for that URL.\n'
		'You have to login with proper credentials', 401,
		{'WWW-Authenticate': 'Basic realm="Login Required"'})

def checkAuthIfSet(f):
	if not username and not password:
		return f
	@wraps(f)
	def decorated(*args, **kwargs):
		auth = flask.request.authorization
		if not auth or not check_auth(auth.username, auth.password):
			return authenticate()
		return f(*args, **kwargs)
	return decorated

''' UI '''

mdExtensions = [
	'markdown.extensions.extra',
	'markdown.extensions.nl2br',
	'markdown.extensions.smarty'
]

@app.route('/')
@checkAuthIfSet
def index():
	recentNotes = glob.glob('notes/*/*')
	recentNotes.sort(key=lambda x: os.stat(x).st_mtime, reverse=True)
	recentNotes = [[x.decode('latin1') for x in path.replace('\\','/').split('/')[1:]]
		for path in recentNotes[:numberOfRecentNotes]]
	return flask.render_template('index.html',
		notebooks=[dir.decode('latin1') for dir in os.listdir('notes/')],
		recentNotes=recentNotes)

@app.route('/edit/<notebook>')
@checkAuthIfSet
def notebook(notebook):
	nbDir = 'notes/%s/' % notebook
	notes = os.listdir(nbDir) # FIXME: don't trust the input
	notes.sort(key=lambda x: os.stat(os.path.join(nbDir, x)).st_mtime, reverse=True) # sort by mod date
	return flask.render_template('notebook.html', notebook=notebook, notes=notes)

@app.route('/edit/<notebook>/<note>')
@checkAuthIfSet
def noteRequest(notebook, note):
	nbDir = 'notes/%s/' % notebook
	notes = os.listdir(nbDir) # FIXME: don't trust the input
	notes.sort(key=lambda x: os.stat(os.path.join(nbDir, x)).st_mtime, reverse=True) # sort by mod date
	path = 'notes/%s/%s' % (notebook, note)
	with open(path) as f:
		return flask.render_template('note.html',
			notebook=notebook, note=note,
			noteData=markdown.markdown(f.read().decode('utf8'),
				output_format='html5',
				extensions=mdExtensions),
			notes=notes,
			mtime=os.path.getmtime(path))

''' API '''

class OverrideWarning(Exception):
	status_code = 403
	def __init__(self, reason):
		self.reason = reason

@app.errorhandler(OverrideWarning)
def handleOverrideWarning(error):
	response = flask.jsonify({
		'reason': error.reason,
	})
	response.status_code = error.status_code
	return response

def indexIgnore(s, sub, ignoreChars):
	'''find substring sub in string s. ignore chars in ignoreChars array.
	returns index in s of first incidence of sub (-1 if no match)'''
	matchInd = 0
	skippedSinceReset = 0
	sub = ''.join(c for c in sub if c not in ignoreChars)
	for i, c in enumerate(s):
		if c in ignoreChars:
			if matchInd:
				skippedSinceReset += 1
			continue
		if c == sub[matchInd]:
			matchInd += 1
			if matchInd == len(sub):
				return i - matchInd + 1 - skippedSinceReset
		elif matchInd:
			skippedSinceReset = 0
			matchInd = 0
			if c == sub[0]:
				matchInd = 1
	return -1

def jsonSearch(query, maxNumResults, responseRadius, notebook='', note=''):
	# TODO: implement note filter (last two parameters)
	if not notebook and note:
		flask.abort(404)
	if not query:
		return '[]'
	matches = []
	for path, dirs, files in os.walk('notes/'):
		for file in files:
			with open("%s/%s" % (path,file)) as f:
				noteData = f.read().decode('utf8')
				notebookIt = path.replace('\\','/').split('/')[1] # FIXME: only works with perfect structure
				ind = indexIgnore(noteData.lower(), query.lower(), '\r\n')
				if ind != -1:
					isShortened = False
					beginInd = max(0, ind-responseRadius)
					endInd = min(ind+responseRadius+len(query), len(noteData))
					if beginInd > 0 or endInd < len(noteData):
						isShortened = True
					response = '%s%s%s' % ('...' if beginInd else '', noteData[beginInd:endInd], '...' if endInd<len(noteData) else '')
					matches += [{
						'shortened': isShortened,
						'response': response,
						'notebook': notebookIt.decode('latin1'),
						'note': file.decode('latin1')
					}]
				else:
					ind1 = indexIgnore(notebookIt.lower(), query.lower(), '\r\n')
					ind2 = indexIgnore(file.decode('latin1').lower(), query.lower(), '\r\n')
					if ind1 != -1 or ind2 != -1:
						matches += [{
							'shortened': False,
							'notebook': notebookIt.decode('latin1'),
							'note': file.decode('latin1')
						}]
				if len(matches) >= int(maxNumResults):
					return flask.json.dumps(matches)
	return flask.json.dumps(matches)

@app.route('/api/notebooks', methods=['GET'])
@checkAuthIfSet
def apiGetNotebooks():
	recentNotes = glob.glob('notes/*/*')
	recentNotes.sort(key=lambda x: os.stat(x).st_mtime, reverse=True)
	recentNotes = [[x.decode('latin1') for x in path.replace('\\','/').split('/')[1:]]
		for path in recentNotes[:numberOfRecentNotes]]
	return flask.json.dumps({
		'notebooks': [item.decode('latin1') for item in os.listdir('notes/') if os.path.isdir('notes/%s' % item)],
		'recentNotes': recentNotes,
	})

@app.route('/api/notes', methods=['GET'])
@checkAuthIfSet
def apiGetNotes():
	nbDir = 'notes/%s/' % flask.request.args['notebook']
	notes = os.listdir(nbDir)
	notes.sort(key=lambda x: os.stat(os.path.join(nbDir, x)).st_mtime, reverse=True) # sort by mod date
	return flask.json.dumps({
		'notebook': flask.request.args['notebook'],
		'notes': notes
		})

@app.route('/api/note', methods=['GET'])
@checkAuthIfSet
def apiGetNote():
	'''returns an entire unprocessed note file in a json object'''
	# FIXME: not safe to trust client-provided strings in path str
	path = 'notes/%s/%s' % (flask.request.args['notebook'], flask.request.args['note'])
	with open(path) as f:
		return flask.json.dumps({
			'note': flask.request.args['note'],
			'notebook': flask.request.args['notebook'],
			'noteData': markdown.markdown(f.read().decode('utf8'),
				output_format='html5',
				extensions=mdExtensions),
			'mtime': os.path.getmtime(path),
			})

@app.route('/api/note', methods=['DELETE'])
@checkAuthIfSet
def apiDeleteNote():
	# FIXME: not safe to trust client-provided strings in path str
	# move the files to a trashbin in ./delete/
	if not os.path.exists('deleted/'):
		os.mkdir('deleted/')
	if not os.path.exists('deleted/%s/' % flask.request.args['notebook']):
		os.mkdir('deleted/%s/' % flask.request.args['notebook'])
	combinedPath = '%s/%s' % (flask.request.args['notebook'], flask.request.args['note'])
	delPath = combinedPath
	while os.path.exists('deleted/%s' % delPath):
		# conflicting notes
		delPath += '_'
	os.rename('notes/%s' % combinedPath, 'deleted/%s' % delPath)
	return flask.json.dumps({'success':True})

@app.route('/api/note', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiPutNote():
	# set all data (which may be an empty string) exactly in the given notebook and note
	# (they are created if they do not exist)
	# NOTE: json must be  stored as payload using mimetype application/json
	#       not in query str
	if not os.path.exists('notes/'):
		os.mkdir('notes/')
	if not os.path.exists('notes/%s' % flask.request.args['notebook']):
		os.mkdir('notes/%s' % flask.request.args['notebook'])
	path = "notes/%s/%s" % (flask.request.args['notebook'],
		flask.request.args['note'])
	json = flask.request.get_json()
	if not json['override'] and os.path.isfile(path):
		if round(float(flask.request.args['mtime']), 2) < round(os.path.getmtime(path), 2):
			raise OverrideWarning(reason='old_mtime')
	data = json['data']
	data = html2markdown.convert(data).encode('utf8')
	with open(path, "w") as f:
		f.write(data)
	return flask.json.dumps({'success':True, 'mtime':os.path.getmtime(path)})

@app.route('/api/notebook', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiPutNotebook():
	if not os.path.exists('notes/'):
		os.mkdir('notes/')
	os.mkdir('notes/%s' % flask.request.args['notebook'])
	return flask.json.dumps({'success':True})

@app.route('/api/notebook', methods=['DELETE'])
@checkAuthIfSet
def apiDeleteNotebook():
	# FIXME: not safe to trust client-provided strings in path str
	# move the files to a trashbin in ./delete/
	if not os.path.exists('deleted/'):
		os.mkdir('deleted/')
	delPath = flask.request.args['notebook']
	while os.path.exists('deleted/%s' % delPath):
		# conflicting notes
		delPath += '_'
	os.rename('notes/%s/' % flask.request.args['notebook'], 'deleted/%s' % delPath)
	return flask.json.dumps({'success':True})

@app.route('/api/rename', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiRenameNote():
	jsData = flask.request.get_json()
	# TODO: check whether the file/note already exists
	os.rename('notes/%s/%s' % (jsData['sourceNotebook'], jsData['sourceNote']),
		'notes/%s/%s' % (jsData['targetNotebook'], jsData['targetNote']))
	return flask.json.dumps({'success':True})

@app.route('/api/copy', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiCopyNote():
	jsData = flask.request.get_json()
	# TODO: check whether the file/note already exists
	shutil.copyfile('notes/%s/%s' % (jsData['sourceNotebook'], jsData['sourceNote']),
		'notes/%s/%s' % (jsData['targetNotebook'], jsData['targetNote']))
	return flask.json.dumps({'success':True})

@app.route('/api/search')
@checkAuthIfSet
def apiSearch():
	'''returns JSON string (partial strings surrounding the matches) or renders html page'''
	#notebook = flask.request.args.get('notebook', '') # if only this, then search all notes in that notebook
	#note = flask.request.args.get('note', '') # if neither, search all notes
	# FIXME: always searching in all notes for now
	# FIXME: unsafe: possible slashes in query string
	# TODO: return all instances in the same note?
	return jsonSearch(flask.request.args['q'], int(flask.request.args['maxNumResults']), int(flask.request.args['responseRadius']),
		flask.request.args.get('notebook', ''), flask.request.args.get('note', ''))
	
if __name__ == '__main__':
	app.run()