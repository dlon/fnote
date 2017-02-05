function makeNoteUrl(newNotebook = '', newNote = '') {
	locArray = window.location.pathname.split('/');
	if (!locArray[3]) {
		return window.location.pathname;
	}
	if (newNotebook) {
		locArray[2] = newNotebook;
	}
	if (newNote) {
		locArray[3] = newNote;
	}
	return locArray.join('/');
}
function getNotebook() {
	locArray = window.location.pathname.split('/');
	if (locArray[1].toLowerCase() == 'edit') {
		return decodeURIComponent(locArray[2]);
	}
}
function getNote() {
	locArray = window.location.pathname.split('/');
	if (locArray[1].toLowerCase() == 'edit' && locArray[3]) {
		return decodeURIComponent(locArray[3]);
	}
}

$(document).ready(function() {
	hbSearchboxTemplate = Handlebars.compile($('#searchbox-template').html());

	$('[data-toggle="tooltip"]').tooltip();

	var searchHistoryTimer = 0;
	var hbSearchboxTemplate;
	var editNotebook, editNote;

	editNotebook = getNotebook();
	editNote = getNote();
	$('#document-title').val(editNote);

	var deleteNotebookAnchor = $('#delete-nb');
	if (!deleteNotebookAnchor) {
		deleteNotebookAnchor = $('<a href="javascript:void(0)" id="delete-nb" class="text-danger" data-toggle="tooltip" data-placement="bottom" title="Delete notebook"></a>')
			.append('<span class="glyphicon glyphicon-remove" aria-hidden="true" data-toggle="modal" data-target="#modal-delete-notebook"></span>');
	}

	function processJsonSearchData(data, searchStr, updateHistory=true) {
		$('#search-results-container').empty();
		if (!data.length) {
			return;
		}
		let searchRes = $('<div class="search-results"></div>');
		for (let v of data) {
			if (v.response) {
				v.response = v.response.replace(/<(?:.|\n)*?>/gm, ''); // strip html
				// bolden matched text
				let matchIndex = v.response.toLowerCase().indexOf(searchStr.toLowerCase()),
					matchLen = searchStr.length;
				v.response = v.response.slice(0, matchIndex)
					+ "<strong>"+v.response.slice(matchIndex,matchIndex+matchLen)+"</strong>"
					+ v.response.slice(matchIndex+matchLen);
			}
			let matchLen = searchStr.length;
			let matchIndex = v.notebook.toLowerCase().indexOf(searchStr.toLowerCase());
			v.notebook_plain = v.notebook;
			if (matchIndex !== -1) {
				v.notebook = v.notebook.slice(0, matchIndex)
					+ "<strong>"+v.notebook.slice(matchIndex,matchIndex+matchLen)+"</strong>"
					+ v.notebook.slice(matchIndex+matchLen);
			}
			matchIndex = v.note.toLowerCase().indexOf(searchStr.toLowerCase());
			if (matchIndex !== -1) {
				v.note = v.note.slice(0, matchIndex)
					+ "<strong>"+v.note.slice(matchIndex,matchIndex+matchLen)+"</strong>"
					+ v.note.slice(matchIndex+matchLen);
			}
			// insert search result
			searchRes.append($(hbSearchboxTemplate(v)));
		}
		searchRes.appendTo('#search-results-container');
		// add hover effects
		$('.searchbox').hover(function(){
			$(this).animate({'background-color':"#eee"}, 200);
		}, function(){
			$(this).animate({'background-color':"#ddd"}, 200);
		});
		// load only the note (not entire page)
		$('.search-results a').click(function(ev) {
			if (ev.ctrlKey) {
				return true;
			}
			ev.preventDefault();
			var linkSplit = $(this).attr('href').split('/');
			navLoadNote(linkSplit[2], linkSplit[3]);
			$('.search-results').hide({});
		});

		if (updateHistory) {
			if (searchHistoryTimer) {
				clearTimeout(searchHistoryTimer);
			}
			searchHistoryTimer = setTimeout(function() {
				window.history.pushState({
					inputValue:searchStr
				}, 'search', '');
			}, 1000);
		}
	}
	function searchFor(str, updateHistory=true) {
		$.ajax('/api/search', {
			method: 'GET',
			dataType: 'json',
			data: {
				q: str,
				responseRadius: 50,
				maxNumResults: 10
			}
		}).done(function(data) {
			processJsonSearchData(data, str, updateHistory);
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error while searching (' + textStatus + ')'
			}));
		});
	}

	// search
	$('input[name="searchbar"]').keyup(function(ev) {
		if (ev.which === 13 || ev.which === 37 || ev.which === 38 || ev.which === 39 || ev.which === 40) {
			return;
		}
		searchFor($(this).val());
	});
	$('input[name="searchbar"]').focus(function(ev) {
		$('.search-results').show();
	});
	// hide search results when clicking outside the search area
	$(document).mouseup(function (e) {
		var elem = $('#search-wrapper');
		if (!elem.is(e.target) && elem.has(e.target).length === 0) {
			elem = $('.search-results'); // using #search-wrapper
			elem.hide({});
		}
	});

	var lastSaveState = null;
	var isSaving = false;
	var saveTimer = 0;
	var saveFadeOutTimer = 0;
	function stateHasChanged(editor) {
		return editor.getContent() !== lastSaveState;
	}
	function saveFunc(editor, override=false) {
		if (saveTimer) {
			clearTimeout(saveTimer);
		}
		saveTimer = setTimeout(function sft() {
			if (isSaving) {
				setTimeout(sft, 500);
				return;
			}
			saveTimer = 0;
			if (!editNotebook || !editNote) {
				$('.document-status').html('<span id="save-icon-warning" class="fa fa-times-circle fa-fw"></span>')
					.show()
					.children().attr('title', 'No note is open. Text will not be saved.');
				return;
			}
			var newSaveState = editor.getContent();
			if (lastSaveState === newSaveState) {
				return; // no changes were made
			}
			isSaving = true;
			if (saveFadeOutTimer) {
				clearTimeout(saveFadeOutTimer);
				saveFadeOutTimer = 0;
			}
			$('.document-status').html('<span id="save-icon-spinner" class="fa fa-spinner fa-spin fa-fw"></span>').show();
			$.ajax('/api/note?notebook='+editNotebook+'&note='+editNote+'&mtime='+editMtime, {
				method: 'POST',
				contentType: 'application/json',
				dataType: 'json',
				data: JSON.stringify({
					data: newSaveState,
					override: override,
				})
			}).done(function(data) {
				editMtime = data.mtime;
				lastSaveState = newSaveState;
				var elm = $('.document-status').html('<span id="save-icon-done" class="fa fa-check-circle fa-fw"></span>');
				saveFadeOutTimer = setTimeout(function(){elm.fadeOut();}, 1000);
				let activeLi = $('.notebooks-list li.active');
				if (!activeLi.is('.notebooks-list li:first')) {
					activeLi.hide({always: function() {
						$(this).detach().prependTo('.notebooks-list ul');
						$(this).show({});
					}});
				}
				isSaving = false;
			}).fail(function(xhr, textStatus, errorThrown) {
				isSaving = false;
				var elm = $('.document-status').html('<span id="save-icon-failed" class="fa fa-times-circle fa-fw"></span>');
				if (xhr.status==403) {
					let responseJson = JSON.parse(xhr.responseText);
					if (responseJson.reason === 'old_mtime') {
						$('#modal-confirm-overwrite').modal();
						return;
					}
				}
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error saving note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
				}));
			});
		}, 400);
	}

	tinymce.init({
		selector: '#tinymce-area',
		//height: 500,
		theme: 'modern',
		//skin: 'light',
		skin: 'custom', // NOTE: created using skin.tinymce.com
		menubar:false,
		image_caption:true,
		plugins: [
			'advlist autolink lists link image charmap print hr anchor pagebreak',
			'searchreplace wordcount visualblocks visualchars code fullscreen',
			'insertdatetime media nonbreaking save table contextmenu directionality',
			'template paste textcolor colorpicker textpattern imagetools codesample toc',
			'nonbreaking'
		],
		toolbar: "undo redo | styleselect | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent table | link image media | codesample print insert fullscreen",
		image_advtab: true,
		templates: [
			{ title: 'Test template 1', content: 'Test 1' },
			{ title: 'Test template 2', content: 'Test 2' }
		],
		inline:true,
		fixed_toolbar_container:'#toolbar-container',
		autofocus:true,
		init_instance_callback: function() {
			lastSaveState = tinymce.activeEditor.getContent();
			tinymce.activeEditor.focus();
		},
		setup: function (editor) {
			editor.on('blur', function () {
				return false;
			});
			editor.on('keyup', function(ev) {
				if (ev.keyCode>=33 && ev.keyCode<=40) { // pgup, pgdown, end, home, & arrow keys
					// arrows
					return true;
				}
				saveFunc(editor);
			});
			editor.on('change', function(ev){saveFunc(editor);}); // only updates when undo states are created
			editor.on('keydown', function(ev) {
				if (ev.keyCode == 9) {
					if (editor.selection.getNode().nodeName == 'TD') {
						return true;
					} else if (ev.ctrlKey) {
						ev.preventDefault();
						return false;
					} else {
						editor.execCommand('mceInsertContent', false, '&emsp;');
						ev.preventDefault();
						return false;
					}
				}
			});
		},
		end_container_on_empty_block: true
	});
	
	// nav
	var hbNotelistTemplate = Handlebars.compile($('#notelist-template').html());
	var hbNotebooksTemplate = Handlebars.compile($('#notebooks-template').html());
	var hbAlertError = Handlebars.compile($('#alert-error-template').html());
	function navLoadHome(updateHistory = true) {
		$.ajax('/api/notebooks', {
			method: 'GET',
			dataType: 'json'
		}).done(function(data) {
			$('#sidebar .breadcrumb').html('<li>Home</li>');
			$('.notebooks-list').empty();
			$('.notebooks-list').append(hbNotebooksTemplate({
				notebooks:data.notebooks,
				recentNotes:data.recentNotes,
			}));

			if (updateHistory) {
				window.history.pushState({'navLevel': 1}, 'nbnav', '/');
			}

			setSidebarEvents();
			restyleSidebarNotes();

			deleteNotebookAnchor.detach();
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading notebooks (' + textStatus + ')'
			}));
		});
	}
	function navLoadNotebook(notebook, updateHistory = true, loadBreadcrumb = true) {
		if (!notebook) {
			navLoadHome(updateHistory);
			return;
		}
		$.ajax('/api/notes', {
			method: 'GET',
			dataType: 'json',
			data: {
				notebook: notebook
			}
		}).done(function(data) {
			if (loadBreadcrumb) {
				$('#sidebar .breadcrumb').html('<li><a href="/">Home</a></li>').append('<li>'+notebook+'</li>');
			}
			$('.notebooks-list').empty();
			$('.notebooks-list').append(hbNotelistTemplate({
				notes:data.notes,
				notebook:notebook
			}));

			if (updateHistory) {
				window.history.pushState({navLevel: 2, navNb:notebook}, 'nbnav', '/edit/'+notebook);
			}

			setSidebarEvents();
			restyleSidebarNotes();

			deleteNotebookAnchor.appendTo('#nav-tools');
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading notebook "'+notebook+'" (' + textStatus + ')'
			}));
		});
	}
	function navLoadNote(notebook, note, updateHistory = true) {
		if (editNote === note && editNotebook === notebook) {
			return;
		}
		$.ajax('/api/note', {
			method: 'GET',
			dataType: 'json',
			data: {
				notebook: notebook,
				note: note
			}
		}).done(function(data) {
			if (stateHasChanged(tinymce.activeEditor)) {
				if (!window.confirm('You have unsaved changes. Are you sure?')) {
					return;
				}
			}
			$('.document-status').hide();
			// breadcrumb
			$('#sidebar .breadcrumb').html('<li><a href="/">Home</a></li>')
				.append('<li><a href="/edit/'+notebook+'">'+notebook+'</a></li>')
				.append('<li>'+note+'</li>');
			let oldNotebook = editNotebook;
			// notes
			$('#document-title').val(data.note);
			tinymce.activeEditor.setContent(data.noteData);
			editNotebook = notebook;
			editNote = note;
			editMtime = data.mtime;
			reloadNotebooksSelect(editNotebook);
			document.title = note + ' - Freenote';
			if (updateHistory) {
				window.history.pushState({navLevel: 3, notebook:notebook, note:note}, 'nbnav', '/edit/'+notebook+'/'+note);
			}
			setSidebarEvents(reloadNotelinks=false);
			restyleSidebarNotes();
			lastSaveState = tinymce.activeEditor.getContent();
			// reload sidebar notebook (TODO: handle this differently? breadcrumb looks weird when in different notebook)
			if (notebook !== oldNotebook) {
				navLoadNotebook(notebook, updateHistory = false, loadBreadcrumb = false);
			}
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading note "'+notebook+'/'+note+'" (' + textStatus + ')'
			}));
		});
	}
	function setSidebarEvents(reloadNotelinks=true) {
		$('#sidebar .breadcrumb a[href="/"]').click(function(ev) {
			ev.preventDefault();
			navLoadHome();
		});
		$('#sidebar .breadcrumb a[href^="/edit/"]').click(function(ev) {
			if (ev.ctrlKey) {
				return true;
			}
			ev.preventDefault();
			navLoadNotebook($(this).attr('href').split('/')[2]);
		});
		if (reloadNotelinks) {
			$('.notebooks-list a').click(function(ev) {
				if (ev.ctrlKey) {
					return true;
				}
				ev.preventDefault();
				let href = $(this).attr('href').split('/');
				if (href[1] === 'edit') {
					if (!href[3]) {
						navLoadNotebook(href[2]);
					} else {
						navLoadNote(href[2], href[3]);
					}
				}
			});
			if (getNotebook()) {
				sidebarSetNoteToolbarEvents();
			}
		}
	}
	function restyleSidebarNotes() {
		if (!editNote || getNotebook() !== editNotebook) {
			$('.notebooks-list li.active').removeClass('active');
			return;
		}
		$('.notebooks-list li').each(function(i,e) {
			if (editNote === $(this).find('a').text()) {
				$(this).addClass('active');
			} else {
				$(this).removeClass('active');
			}
		});
	}

	// sidebar note toolbar buttons
	var noteToolbarDlgs = null,
		noteToolbarNote = null,
		noteToolbarNotebook = null;
	function sidebarSetNoteToolbarEvents() {
		// NOTE: called by setSidebarEvents()
		if (noteToolbarDlgs === null) {
			$.get('/static/noteToolbar.html', function(data) {
				noteToolbarDlgs = $('body').append(data);
				let deleteDlg = $('#tb-modal-delete-note');
				let renameDlg = $('#tb-modal-rename-note');
				deleteDlg.on('show.bs.modal', function(e) {
					$(this).find('.modal-body').text("Are you sure you wish to delete '"+noteToolbarNote+"'?");
				});
				deleteDlg.on('shown.bs.modal', function(e) {
					$(this).find(':submit').focus();
				});
				deleteDlg.find(':submit').click(function(e) {
					e.preventDefault();
					$.ajax('/api/note?notebook='+noteToolbarNotebook+'&note='+noteToolbarNote, {
						method: 'DELETE',
						dataType: 'json'
					}).done(function(data) {
						deleteDlg.modal('hide');
						if (editNote === noteToolbarNote && editNotebook === noteToolbarNotebook) {
							// reset URL if necessary
							if (getNote() === noteToolbarNote && getNotebook() === noteToolbarNotebook) {
								navLoadNotebook(noteToolbarNotebook, updateHistory = true, loadBreadcrumb = true);
							} else {
								navLoadNotebook(noteToolbarNotebook, updateHistory = false, loadBreadcrumb = false);
							}
							// unload the current note
							editNotebook = null;
							editNote = null;
							lastSaveState = null;
							document.title = 'Freenote';
							$('#document-title').val('');
							reloadNotebooksSelect();
							tinymce.activeEditor.setContent('');
						} else {
							navLoadNotebook(noteToolbarNotebook, updateHistory = false, loadBreadcrumb = false);
						}
					}).fail(function(xhr, textStatus, errorThrown) {
						$('#content').prepend(hbAlertError({
							bolded: errorThrown,
							message: 'Error deleting note "'+noteToolbarNotebook+'/'+noteToolbarNote+'" (' + textStatus + ')'
						}));
					});
				});
				renameDlg.on('show.bs.modal', function(e) {
					$(this).find('.help-block').text('');
					$(this).find('input').val(noteToolbarNote);
					let selectElem = $(this).find('select');
					$.ajax('/api/notebooks', {
						method: 'GET',
						dataType: 'json'
					}).done(function(data) {
						selectElem.empty();
						for (let nb of data.notebooks) {
							selectElem.append($('<option></option>').text(nb));
						}
						selectElem.selectpicker('refresh');
						selectElem.selectpicker('val', noteToolbarNotebook);
					}).fail(function(xhr, textStatus, errorThrown) {
						$('#content').prepend(hbAlertError({
							bolded: errorThrown,
							message: 'Error loading notebooks (' + textStatus + ')'
						}));
						renameDlg.modal('hide');
					});
				});
				renameDlg.on('shown.bs.modal', function(e) {
					$('input', this).select();
				});
				renameDlg.find(':submit').click(function(e) {
					e.preventDefault();
					renameDlg.modal('hide');
					$.ajax('/api/rename', {
						method: 'POST',
						contentType: 'application/json',
						data: JSON.stringify({
							sourceNotebook:noteToolbarNotebook,
							sourceNote:noteToolbarNote,
							targetNotebook:renameDlg.find('select').val(),
							targetNote:renameDlg.find('input').val(),
						})
					}).done(function(data) {
						navLoadNotebook(noteToolbarNotebook, updateHistory = false, loadBreadcrumb = false);
						// TODO: deal with current note being renamed
						renameDlg.modal('hide');
					}).fail(function(xhr, textStatus, errorThrown) {
						$('#content').prepend(hbAlertError({
							bolded: errorThrown,
							message: 'Error moving/renaming note "'+noteToolbarNotebook+'/'+noteToolbarNote+'" (' + textStatus + ')'
						}));
					});
				});

				sidebarSetNoteToolbarEvents();
			});
			return;
		}
		function setTbVars(noteLi) {
			let noteLink = noteLi.find('a').attr('href').split('/');
			noteToolbarNotebook = noteLink[2];
			noteToolbarNote = noteLink[3];
		}
		$('.tb-delete-note').click(function (e) {
			setTbVars($(this).closest('li'));
			$('#tb-modal-delete-note').modal();
		});
		$('.tb-rename-note').click(function (e) {
			setTbVars($(this).closest('li'));
			$('#tb-modal-rename-note').modal();
		});
		$('.tb-duplicate-note').click(function (e) {
			setTbVars($(this).closest('li'));
			$.ajax('/api/copy', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					sourceNotebook:noteToolbarNotebook,
					sourceNote:noteToolbarNote,
					targetNotebook:noteToolbarNotebook,
					targetNote:noteToolbarNote + " - duplicate",
				})
			}).done(function(data) {
				navLoadNotebook(noteToolbarNotebook, updateHistory = false, loadBreadcrumb = false);
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error duplicating note "'+noteToolbarNotebook+'/'+noteToolbarNote+'" (' + textStatus + ')'
				}));
			});
		});
	}

	setSidebarEvents();

	// dropdown notebook setting
	function reloadNotebooksSelect(activeNotebook = '') {
		$.ajax('/api/notebooks', {
			method: 'GET',
			dataType: 'json'
		}).done(function(data) {
			$('#document-notebook').empty();
			for (let nb of data.notebooks) {
				$('#document-notebook').append($('<option></option>').text(nb));
			}
			$('#document-notebook').selectpicker('refresh');
			if (activeNotebook) {
				$('#document-notebook').selectpicker('val', activeNotebook);
			}
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading notebooks (' + textStatus + ')'
			}));
		});
	}
	$('#document-notebook').change(function() {
		if (!editNote || !editNotebook) {
			return;
		}
		var newNotebook = $('#document-notebook option:selected').text();
		$.ajax('/api/rename', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({
				sourceNotebook:editNotebook,
				sourceNote:editNote,
				targetNotebook:newNotebook,
				targetNote:editNote
			})
		}).done(function(data) {
			// update url & sidebar & notebook ref
			if (getNotebook() === editNotebook) {
				if (getNote() === editNote) {
					window.history.replaceState(
						{navLevel: 3, notebook:newNotebook, note:editNote},
						'nbnav',
						makeNoteUrl(newNotebook, editNote)
					);
					navLoadNotebook(newNotebook, updateHistory=false, loadBreadcrumb=false);
					$('.breadcrumb li:nth-child(2)').html('<a href="/edit/'+newNotebook+'">'+newNotebook+'</a>');
				} else {
					navLoadNotebook(editNotebook, updateHistory=false, loadBreadcrumb=false);
				}
			} else if (getNotebook() === newNotebook) {
				navLoadNotebook(newNotebook, updateHistory=false, loadBreadcrumb=false);
			}
			editNotebook = newNotebook;
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error moving/renaming note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
			}));
		});
	});
	reloadNotebooksSelect(editNotebook);

	// editing the title/file name
	var renamingTimer = 0;
	var isrenaming = false;
	$('#document-title').keydown(function(ev) {
		// TODO: only update if changed
		if (!editNote || !editNotebook || isrenaming) {
			return;
		}
		if (renamingTimer) {
			clearTimeout(renamingTimer);
		}
		renamingTimer = setTimeout(function() {
			renamingTimer = 0;
			let newNote = $('#document-title').val();
			isrenaming = true;
			$.ajax('/api/rename', {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					sourceNotebook:editNotebook,
					sourceNote:editNote,
					targetNotebook:editNotebook,
					targetNote:newNote
				})
			}).done(function(data) {
				// update title, url & sidebar
				if (getNotebook() === editNotebook) {
					$('.notebooks-list a').each(function() {
						if (editNote === $(this).text()) {
							$(this).text(newNote);
							$(this).attr('href', '/edit/'+editNotebook+'/'+newNote);
						}
					});
					if (getNote() === editNote) {
						$('.breadcrumb > li:last').text(newNote);
						window.history.replaceState(
							{navLevel: 3, notebook:editNotebook, note:newNote},
							'nbnav',
							makeNoteUrl(editNotebook, newNote)
						);
					}
				}
				document.title = newNote + ' - Freenote';
				editNote = newNote;
				isrenaming = false;
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error moving/renaming note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
				}));
				isrenaming = false;
			});
		}, 200);
	});

	// modal dialogs (except sidebar note toolbar)
	$('#dialogs').load('/static/dialogs.html', function() {
		$('#modal-new-note').on('show.bs.modal', function (e) {
			$('#m-note-fg-name').removeClass('has-error');
			$('#m-note-fg-nb').removeClass('has-error');
			$('#m-note-fg-name .help-block').text('');
			$('#m-note-fg-nb .help-block').text('');

			//$('input', this).val('');
			let selectElem = $('#m-note-selected-notebook');
			$.ajax('/api/notebooks', {
				method: 'GET',
				dataType: 'json'
			}).done(function(data) {
				selectElem.empty();
				for (let nb of data.notebooks) {
					selectElem.append($('<option></option>').text(nb));
				}
				selectElem.selectpicker('refresh');
				let nb = getNotebook();
				if (nb) {
					selectElem.selectpicker('val', nb);
				}
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error loading notebooks (' + textStatus + ')'
				}));
				$('#modal-new-note').modal('hide');
			});
		});
		$('#modal-new-note').on('shown.bs.modal', function (e) {
			$('input', this).select();
		});
		$('#modal-new-note form').submit(function(ev) {
			ev.preventDefault();
			// TODO: FIXME: make sure the note doesn't already exist
			
			var tNote = $('#m-note-name').val();
			var tNb = $('#m-note-selected-notebook').val();
			if (!tNote) {
				$('#m-note-fg-name').addClass('has-error');
				$('#m-note-fg-name .help-block').text('You must name the note');
			} else {
				$('#m-note-fg-name').removeClass('has-error');
				$('#m-note-fg-name .help-block').text('');
			}
			if (!tNb) {
				$('#m-note-fg-nb').addClass('has-error');
				$('#m-note-fg-nb .help-block').text('You must select a notebook');
			} else {
				$('#m-note-fg-nb').removeClass('has-error');
				$('#m-note-fg-nb .help-block').text('');
			}
			if (!tNote || !tNb) {
				return;
			}

			// TODO: check whether it already exists
			// if it does, add an error message below the note name as above

			// create an empty note
			$.ajax('/api/note?notebook='+tNb+'&note='+tNote, {
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					data: '',
					override: false,
				})
			}).done(function(data) {
				navLoadNote(tNb, tNote);
				$('#modal-new-note').modal('hide');
				$('#m-note-name').val('');
				// FIXME: make sure this is the proper way to reload the sidebar
				navLoadNotebook(tNb, updateHistory=false);
				tinymce.activeEditor.focus();
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error saving note "'+tNb+'/'+tNote+'" (' + textStatus + ')'
				}));
			});
		});
		$('#modal-new-notebook form').submit(function(ev) {
			ev.preventDefault();
			// TODO: list existing notebooks?
			var tNb = $('#m-notebook-name').val();
			if (!tNb) {
				$('#m-notebook-fg-name').addClass('has-error');
				$('#m-notebook-fg-name .help-block').text('You name the notebook');
				return;
			} else {
				$('#m-notebook-fg-name').removeClass('has-error');
				$('#m-notebook-fg-name .help-block').text('');
			}
			// create notebook
			$.ajax('/api/notebook?notebook='+tNb, {
				method: 'POST'
			}).done(function(data) {
				$('#modal-new-notebook').modal('hide');
				$('#m-notebook-name').val('');
				// FIXME: make sure this is the proper way to reload the sidebar
				navLoadNotebook(tNb);
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error creating notebook "'+tNb+'" (' + textStatus + ')'
				}));
			});
		});
		$('#modal-new-notebook').on('show.bs.modal', function (e) {
			$('#m-notebook-fg-name').removeClass('has-error');
			$('#m-notebook-fg-name .help-block').text('');
		});
		$('#modal-new-notebook').on('shown.bs.modal', function (e) {
			$('input', this).select();
		});
		var delNotebook = null;
		$('#modal-delete-notebook').on('show.bs.modal', function (e) {
			var p = $(this).find('.modal-body p:first');
			delNotebook = getNotebook();
			p.text('Are you sure you wish to delete the notebook "'+delNotebook+'"?');
		});
		$('#modal-delete-notebook .btn-ok').click(function (e) {
			if (!delNotebook) {
				return;
			}
			// delete notebook
			$.ajax('/api/notebook?notebook='+delNotebook, {
				method: 'DELETE',
				dataType: 'json'
			}).done(function(data) {
				$('#modal-delete-notebook').modal('hide');
				navLoadHome();
				// unload the current note
				editNotebook = null;
				editNote = null;
				lastSaveState = null;
				document.title = 'Freenote';
				$('#document-title').val('');
				reloadNotebooksSelect();
				tinymce.activeEditor.setContent('');
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error deleting notebook "'+delNotebook+'" (' + textStatus + ')'
				}));
			});
		});
		$('#modal-confirm-delete .btn-ok').click(function(ev) {
			if (!editNote || !editNotebook) {
				return;
			}
			// delete note
			$.ajax('/api/note?notebook='+editNotebook+'&note='+editNote, {
				method: 'DELETE',
				dataType: 'json'
			}).done(function(data) {
				$('#modal-confirm-delete').modal('hide');
				navLoadNotebook(getNotebook());
				// unload the current note
				editNotebook = null;
				editNote = null;
				lastSaveState = null;
				document.title = 'Freenote';
				$('#document-title').val('');
				reloadNotebooksSelect();
				tinymce.activeEditor.setContent('');
			}).fail(function(xhr, textStatus, errorThrown) {
				$('#content').prepend(hbAlertError({
					bolded: errorThrown,
					message: 'Error deleting note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
				}));
			});
		});
		$('#modal-confirm-overwrite .btn-ok').click(function(ev) {
			$('#modal-confirm-overwrite').modal('hide');
			saveFunc(tinymce.activeEditor, override=true);
		});
	});
	
	window.onpopstate = function(ev) {
		// TODO: cache the search results?
		if (ev.state && ev.state.inputValue) {
			$('input[name="searchbar"]').val(ev.state.inputValue);
			searchFor(ev.state.inputValue, updateHistory = false);
		} else {
			$('input[name="searchbar"]').val('');
			$('.search-results').hide(function(){
				$(this).remove();
			});
		}

		if (ev.state && ev.state.navLevel) {
			if (ev.state.navLevel === 1) { navLoadHome(updateHistory = false); }
			else if (ev.state.navLevel === 2) { navLoadNotebook(ev.state.navNb, updateHistory = false); }
			else if (ev.state.navLevel === 3) { navLoadNote(ev.state.notebook, ev.state.note, updateHistory = false); }
		}
	};

	window.onbeforeunload = function(ev) {
		if (stateHasChanged(tinymce.activeEditor)) {
			var text_ = "You have unsaved changes. Are you sure?";
			ev.returnValue = text_;
			return text_;
		}
	};

	$('#content').scroll(function() {
		let dinfo = $('#document-info');
		if (dinfo.position().top + dinfo.height() < 0) {
			$('.document-status-sidebar').show();
		} else {
			$('.document-status-sidebar').hide();
		}
	});
});