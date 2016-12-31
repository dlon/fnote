from flask import Flask
import flask
app = Flask('freenote')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # FIXME: remove. for instantaneous updates

import os
import re

@app.route('/')
def index():
	return flask.render_template('index.html')

@app.route('/request/<notebook>/<note>')
def noteRequest(notebook, note):
	return "%s, %s" % (notebook, note)

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

@app.route('/search')
def search():
	jsonData = jsonSearch(flask.request.args.get('q', ''),
		flask.request.args.get('maxNumResults', 10),
		flask.request.args.get('responseRadius', 50)) # FIXME: somewhat awkward to define default representation here
	print jsonData
	# FIXME: merge both functions? add a "format=json" option?
	return flask.render_template('index.html', searchStr=flask.request.args['q'], searchJsonData=flask.Markup(jsonData))

@app.route('/api/search')
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