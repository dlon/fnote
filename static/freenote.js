var hbSearchboxTemplate = Handlebars.compile($('#searchbox-template').html());
var searchHistoryTimer = 0;

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
		searchRes.append($(hbSearchboxTemplate(v)))
			.appendTo('#search-results-container');
	}
	// add hover effects
	$('.searchbox').hover(function(){
		$(this).animate({'background-color':"#eee"}, 200);
	}, function(){
		$(this).animate({'background-color':"#ddd"}, 200);
	});
	
	if (updateHistory) {
		if (searchHistoryTimer) {
			clearTimeout(searchHistoryTimer);
		}
		searchHistoryTimer = setTimeout(function() {
			window.history.pushState({
				inputValue:searchStr
			}, 'search', '/search?q='+encodeURIComponent(searchStr));
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
	});
}

$(document).ready(function() {
	$('[data-toggle="tooltip"]').tooltip();
	
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
			/*elem.hide(function(){
				$(this).remove();
			});*/
			elem.hide({});
		}
	});
	
	// FIXME: headers tags don't close when pressing enter (as they do in the demos)
	var quill = new Quill('#editor-container', {
		modules: {
			formula: true,
			syntax: true, // FIXME: it gets stuck without this
			toolbar: '#toolbar-container',
			keyboard: {
				bindings: {
					'outputMarkdown': {
						key: 121, // F10
						handler: function() {
							// test: convert to markdown
							var und = new upndown();
							alert(quill.root.innerHTML);
							und.convert(quill.root.innerHTML, function(err, markdown) {
								if (err) {
									console.err(err);
									return;
								}
								alert(markdown);
							});
						}
					}
				}
			}
		},
		placeholder: 'Compose an epic...',
		theme: 'snow',
		// FIXME: video embedding and katex don't work on the last row. appears to be a bug
		bounds: '#content',
		scrollingContainer: '#content'
	});
	var quillTitle = new Quill('#document-title', {
		modules: {
			toolbar: false,
			syntax: true, // FIXME: it gets stuck without this
			keyboard: {
				bindings: {
					'enter': { // disable line insertion
						key: 13,
						handler: function() {
							return false; // FIXME: when tabbing into cursor=0, a line break is still added
						}
					},
					'tab': {
						key: 9,
						handler: function() {
							return true;
						}
					}
				}
			}
		},
		placeholder: 'Title',
		theme: 'snow'
	});
	quillTitle.root.tabIndex = 1;
	quill.root.tabIndex = 2; // FIXME: now how do we tab to the toolbar?
	
	window.onpopstate = function(ev) {
		// TODO: cache the search results?
		if (ev.state) {
			$('input[name="searchbar"]').val(ev.state.inputValue);
			searchFor(ev.state.inputValue, updateHistory = false);
		} else {
			$('input[name="searchbar"]').val('');
			$('.search-results').hide(function(){
				$(this).remove();
			});
		}
	};
});