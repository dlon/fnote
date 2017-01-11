function getNotebook() {
	locArray = window.location.pathname.split('/');
	if (locArray[1].toLowerCase() == 'edit' || locArray[1].toLowerCase() == 'notebook') {
		return decodeURIComponent(locArray[2]);
	}
}
function getNote() {
	locArray = window.location.pathname.split('/');
	if (locArray[1].toLowerCase() == 'edit') {
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

	function processJsonSearchData(data, searchStr, updateHistory=true) {
		let searchRes = $('<div class="search-results"></div>');
		$('#search-results-container').empty();
		for (let v of data) {
			// bolden matched text
			let matchIndex = v.response.toLowerCase().indexOf(searchStr.toLowerCase()),
				matchLen = searchStr.length;
			v.response = v.response.slice(0, matchIndex)
				+ "<strong>"+v.response.slice(matchIndex,matchIndex+matchLen)+"</strong>"
				+ v.response.slice(matchIndex+matchLen);
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

	//var lastSave = 0;
	var lastSaveState = null;
	var saveFunc = function(editor) {
		if (!editNotebook || !editNote) {
			return; // TODO: add error msg
		}
		/*if ($.now() - lastSave < 1000.0) {
			// attempt save at most once per second
			return;
		}
		lastSave = $.now();*/
		var newSaveState = editor.getContent();
		if (lastSaveState === newSaveState) {
			return; // no changes were made
		}
		$('#document-status').text('Saving...').show();
		$.ajax('/api/note?notebook='+editNotebook+'&note='+editNote, {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({
				data: newSaveState
			})
		}).done(function(data) {
			lastSaveState = newSaveState;
			$('#document-status').text('Saved.')
				.delay(3000).fadeOut();
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error saving note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
			}));
		});
		// TODO: add "last saved" info
	};

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
			//'autoresize'
		],
		// fullpage: metadata
		//toolbar: 'undo redo | styleselect | formats | bold italic unline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media | forecolor backcolor | codesample code print', //  insert | styleselect
		//toolbar2: 'print preview | forecolor backcolor | codesample code',
		toolbar: "undo redo | styleselect | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent table | link image media | codesample code print insert fullscreen", // symbols disappeared in 'light' - obsolete?
		image_advtab: true,
		templates: [
			{ title: 'Test template 1', content: 'Test 1' },
			{ title: 'Test template 2', content: 'Test 2' }
		],
		//setup: // FIXME: need the change event from below
		/* INLINING (INLINING|AUTORESIZE) */
		inline:true,
		fixed_toolbar_container:'#toolbar-container',
		autofocus:true,
		init_instance_callback: function() {
			tinymce.activeEditor.focus();
			// TODO: save periodically (setInterval)
		},
		setup: function (editor) {
			editor.on('blur', function () {
				return false;
			});
			editor.on('keyup', function(ev) {
				if (ev.keyCode>=33 && ev.keyCode<=40) { // pgup, pgdown, end, home, & arrow keys
					// arrows
					return;
				}
				saveFunc(editor);
			});
			editor.on('change', function(ev){saveFunc(editor);}); // only updates when undo states are created
			editor.on('keydown', function(ev) {
				// tab indent
				if (ev.keyCode == 9) {
					if (ev.shiftKey) {
						editor.execCommand('Outdent');
					}
					else {
						editor.execCommand('Indent');
					}
					ev.preventDefault();
					return false;
				}
			});
		},
		/* [END INLINING HERE] */
		/* AUTORESIZE (INLINING|AUTORESIZE). (instead of inlining) - cf. also plugin */
		/*autoresize_bottom_padding:0,
		content_css: [
			"http://fonts.googleapis.com/css?family=Open+Sans:300,400",
			"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css",
			"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css",
			"/static/freenote.css"
		],
		content_style: ".mce-content-body{padding:20px;font-size:1.8em}",*/
		/* [END AUTORESIZE STYLE] */
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
				notebooks:data.notebooks
			}));

			if (updateHistory) {
				window.history.pushState({'navLevel': 1}, 'nbnav', '/');
			}

			setSidebarEvents();
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading notebooks (' + textStatus + ')'
			}));
		});
	}
	function navLoadNotebook(notebook, updateHistory = true) {
		$.ajax('/api/notes', {
			method: 'GET',
			dataType: 'json',
			data: {
				notebook: notebook
			}
		}).done(function(data) {
			$('#sidebar .breadcrumb').html('<li><a href="/">Home</a></li>').append('<li>'+notebook+'</li>');
			$('.notebooks-list').empty();
			$('.notebooks-list').append(hbNotelistTemplate({
				notes:data.notes,
				notebook:notebook
			}));

			if (updateHistory) {
				window.history.pushState({navLevel: 2, navNb:notebook}, 'nbnav', '/notebook/'+notebook);
			}

			setSidebarEvents();
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading notebook "'+notebook+'" (' + textStatus + ')'
			}));
		});
	}
	function navLoadNote(notebook, note, updateHistory = true) {
		$.ajax('/api/note', {
			method: 'GET',
			dataType: 'json',
			data: {
				notebook: notebook,
				note: note
			}
		}).done(function(data) {
			// TODO: save the existing note?

			// breadcrumb
			$('#sidebar .breadcrumb').html('<li><a href="/">Home</a></li>')
				.append('<li><a href="/notebook/'+notebook+'">'+notebook+'</a></li>')
				.append('<li>'+note+'</li>');
			// notes
			//navLoadNotebook()

			if (editNote !== note || editNotebook !== notebook) {
				$('#document-title').val(data.note);
				tinymce.activeEditor.setContent(data.noteData);
				editNotebook = notebook;
				editNote = note;
				
				reloadNotebooksSelect(editNotebook);
			}
			if (updateHistory) {
				window.history.pushState({navLevel: 3, notebook:notebook, note:note}, 'nbnav', '/edit/'+notebook+'/'+note);
			}

			setSidebarEvents();
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error loading note "'+notebook+'/'+note+'" (' + textStatus + ')'
			}));
		});
	}
	function setSidebarEvents() {
		$('#sidebar .breadcrumb a[href="/"]').click(function(ev) {
			ev.preventDefault();
			navLoadHome();
		});
		$('#sidebar .breadcrumb a[href^="/notebook/"]').click(function(ev) {
			ev.preventDefault();
			navLoadNotebook($(this).attr('href').split('/')[2]);
		});
		$('.notebooks-list a').click(function(ev) {
			ev.preventDefault();
			let nb = getNotebook();
			if (!nb) {
				navLoadNotebook($(ev.target).text());
			} else {
				navLoadNote(nb, $(ev.target).text());
			}
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
			// TODO: change sidebar (at least breadcrumb) & URL
			// TODO: create history event?
			editNotebook = newNotebook;
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error moving/renaming note "'+editNotebook+'/'+editNote+'" (' + textStatus + ')'
			}));
		});
	});
	reloadNotebooksSelect(editNotebook);

	// modal dialogs
	$('#modal-new-note').on('show.bs.modal', function (e) {
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
			if (editNotebook) {
				selectElem.selectpicker('val', editNotebook);
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
	$('#modal-new-note button[name="add"]').click(function(ev) {
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
				data: ''
			})
		}).done(function(data) {
			navLoadNote(tNb, tNote);
			$('#modal-new-note').modal('hide');
			$('#m-note-name').val('');
			// FIXME: make sure this is the proper way to reload the sidebar
			navLoadNotebook(tNb, updateHistory=false);
		}).fail(function(xhr, textStatus, errorThrown) {
			$('#content').prepend(hbAlertError({
				bolded: errorThrown,
				message: 'Error saving note "'+tNb+'/'+tNote+'" (' + textStatus + ')'
			}));
		});
	});
	
	window.onpopstate = function(ev) {
		// TODO: cache the search results?
		if (ev.state && ev.state.inputValue) {
			$('input[name="searchbar"]').val(ev.state.inputValue);
			console.log('asd');
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
});