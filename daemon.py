# -*- coding: utf-8 -*-
from flask import Flask
import flask
app = Flask('freenote')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # FIXME: remove. for instantaneous updates

import os
import re
import markdown
import html2text

# set user and password to enable HTTP basic authentication
from functools import wraps
username = 'admin'
password = 'pass'

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

@app.route('/')
@checkAuthIfSet
def index():
	return flask.render_template('index.html', notebooks=os.listdir('notes/'))

@app.route('/notebook/<notebook>')
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
	with open('notes/%s/%s' % (notebook, note)) as f:
		# TODO: process the data in some way
		return flask.render_template('note.html',
			notebook=notebook, note=note,
			noteData=markdown.markdown(f.read().decode('utf8'),
				output_format='html5'),
			notes=notes)

''' API '''
	
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
		#flask.abort(200) # FIXME: what error code is appropriate here? 404, 200, or neither?
		raise Exception('notebook must be defined if note is') # FIXME: how do I deal with this?
	if not query:
		return '[]'
	matches = []
	for path, dirs, files in os.walk('notes/'):
		#print path, dirs, files
		for file in files:
			with open("%s/%s" % (path,file)) as f:
				#lines = [line.strip() for line in f]
				#print ''.join(lines)
				noteData = f.read()
				ind = indexIgnore(noteData.lower(), query.lower(), '\r\n')
				if ind != -1:
					'''
					# dump the line(s) back (all lines that the match spans)
					noteData = noteData.replace('\r','\n')
					beginInd = noteData.rfind('\n', 0, ind) + 1
					endInd = noteData.find('\n', ind)
					if endInd == -1:
						endInd = len(noteData)
					return noteData[beginInd:endInd]
					'''
					isShortened = False
					beginInd = max(0, ind-responseRadius)
					endInd = min(ind+responseRadius+len(query), len(noteData))
					if beginInd > 0 or endInd < len(noteData):
						isShortened = True
					response = '%s%s%s' % ('...' if beginInd else '', noteData[beginInd:endInd], '...' if endInd<len(noteData) else '')
					matches += [{
						'shortened': isShortened,
						'response': response,
						'notebook': path.replace('\\','/').split('/')[1], # FIXME: only works with perfect structure
						'note': file
					}]
					if len(matches) >= int(maxNumResults):
						return flask.json.dumps(matches)
	return flask.json.dumps(matches)

@app.route('/api/notebooks', methods=['GET'])
@checkAuthIfSet
def apiGetNotebooks():
	return flask.json.dumps({
		'notebooks': [item for item in os.listdir('notes/') if os.path.isdir('notes/%s' % item)]
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
	with open('notes/%s/%s' % (flask.request.args['notebook'], flask.request.args['note'])) as f:
		return flask.json.dumps({
			'note': flask.request.args['note'],
			'notebook': flask.request.args['notebook'],
			'noteData': markdown.markdown(f.read().decode('utf8'),
				output_format='html5')})

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
	os.rename('notes/%s' % combinedPath, 'deleted/%s' % combinedPath)
	return flask.json.dumps({'success':True})

@app.route('/api/note', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiPutNote():
	# set all data (which may be an empty string) exactly in the given notebook and note
	# (they are created if they do not exist)
	# TODO: backup (under some conditions) before modifying data?
	# NOTE: json must be  stored as payload using mimetype application/json
	#       not in query str
	if not os.path.exists('notes/'):
		os.mkdir('notes/')
	if not os.path.exists('notes/%s' % flask.request.args['notebook']):
		os.mkdir('notes/%s' % flask.request.args['notebook'])
	data = flask.request.get_json()['data']
	parser = html2text.HTML2Text()
	parser.unicode_snob = True
	data = parser.handle(data.decode('utf8'))
	data = data.encode('utf8')
	with open("notes/%s/%s" % (flask.request.args['notebook'],
		flask.request.args['note']), "w") as f:
		f.write(data)
	return flask.json.dumps({'success':True})

@app.route('/api/notebook', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiPutNotebook():
	if not os.path.exists('notes/'):
		os.mkdir('notes/')
	os.mkdir('notes/%s' % flask.request.args['notebook'])
	return flask.json.dumps({'success':True})

@app.route('/api/rename', methods=['PUT', 'POST'])
@checkAuthIfSet
def apiRenameNote():
	jsData = flask.request.get_json()
	# TODO: check whether the file/note already exists
	os.rename('notes/%s/%s' % (jsData['sourceNotebook'], jsData['sourceNote']),
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