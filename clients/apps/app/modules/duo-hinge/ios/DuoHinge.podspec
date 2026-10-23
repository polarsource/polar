Pod::Spec.new do |s|
  s.name           = 'DuoHinge'
  s.version        = '1.0.0'
  s.summary        = 'Hinge state and fold region for iPhone Duo'
  s.author         = 'Polar'
  s.homepage       = 'https://polar.sh'
  s.license        = 'Apache-2.0'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
