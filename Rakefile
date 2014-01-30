require 'rubygems'
require 'erb'
require 'fileutils'
require 'rake/testtask'
require 'json'

desc "Build the documentation page"
task :doc do
  source = 'documentation/index.html.erb'
  child = fork { exec "bin/cough -bcw -o documentation/js documentation/cough/*.cough" }
  at_exit { Process.kill("INT", child) }
  Signal.trap("INT") { exit }
  loop do
    mtime = File.stat(source).mtime
    if !@mtime || mtime > @mtime
      rendered = ERB.new(File.read(source)).result(binding)
      File.open('index.html', 'w+') {|f| f.write(rendered) }
    end
    @mtime = mtime
    sleep 1
  end
end

desc "Build cough-syrup-source gem"
task :gem do
  require 'rubygems'
  require 'rubygems/package'

  gemspec = Gem::Specification.new do |s|
    s.name      = 'cough-syrup-source'
    s.version   = JSON.parse(File.read('package.json'))["version"]
    s.date      = Time.now.strftime("%Y-%m-%d")

    s.homepage    = ""
    s.summary     = "The CoughSyrup Compiler"
    s.description = <<-EOS
      CoughSyrup is a little language that compiles into JavaScript.
      Underneath all of those embarrassing braces and semicolons,
      JavaScript has always had a gorgeous object model at its heart.
      CoughSyrup is an attempt to expose the good parts of JavaScript
      in a simple way.
    EOS

    s.files = [
      'lib/cough_syrup/cough-syrup.js',
      'lib/cough_syrup/source.rb'
    ]

    s.authors           = ['Matthew Hilty', 'Jeremy Ashkenas']
    s.email             = ''
    s.rubyforge_project = 'cough-syrup-source'
    s.license           = "MIT"
  end

  file = File.open("cough-syrup-source.gem", "w")
  Gem::Package.open(file, 'w') do |pkg|
    pkg.metadata = gemspec.to_yaml

    path = "lib/cough_syrup/source.rb"
    contents = <<-ERUBY
module CoughSyrup
  module Source
    def self.bundled_path
      File.expand_path("../cough-syrup.js", __FILE__)
    end
  end
end
    ERUBY
    pkg.add_file_simple(path, 0644, contents.size) do |tar_io|
      tar_io.write(contents)
    end

    contents = File.read("extras/cough-syrup.js")
    path = "lib/cough_syrup/cough-syrup.js"
    pkg.add_file_simple(path, 0644, contents.size) do |tar_io|
      tar_io.write(contents)
    end
  end
end
